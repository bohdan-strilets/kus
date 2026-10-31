import { Injectable, Logger } from '@nestjs/common'
import {
	ENTRY_BACKDATE_MAX_DAYS,
	getDayOffset,
	type LogWorkoutInput,
	matchMuscleGroup,
	muscleGroupSchema,
	normalizeExerciseName,
} from '@kus/shared'

import { formatDbDate } from '../../common/time'
import type { Prisma } from '../../generated/prisma/client'
import type { ExerciseKind, MuscleGroup } from '../../generated/prisma/enums'
import { toId, type WorkoutRefIds } from './workout-refs'
import {
	findSessionToClose,
	getFinishedAt,
	getNewSessionReason,
	getRecordKeys,
	getSessionMessageIds,
	inheritEntryOrigins,
} from './workout-session'
import {
	expandSets,
	getBodyweightMaxReps,
	getLastPerformedAt,
	isRecord,
	toDistanceM,
	type WorkoutRecord,
} from './workout-turn'
import {
	WorkoutDateOutOfRangeException,
	WorkoutNotFoundException,
	WorkoutTurnInconsistentException,
} from './workouts.exceptions'
import { readWorkoutRecords } from './workouts.mapper'
import {
	type ExerciseWrite,
	type SessionFields,
	type WorkoutWithExercises,
	WorkoutsRepository,
	type WorkoutWrite,
} from './workouts.repository'

type ExerciseRow = { id: string; name: string; kind: ExerciseKind; muscleGroup: MuscleGroup | null }

/** What one log_workout call left: the session, its records before the turn, the cards it changed. */
export interface SessionChange {
	workout: WorkoutWithExercises
	/** By exercise and type; empty for a new session. */
	recordsBefore: Set<string>
	/** Earlier user messages whose workout cards changed. */
	messageIds: string[]
}

export interface WriteParams {
	userId: string
	sourceMessageId: string
	now: Date
	/** The user's today; a workout of another day gets the middle of it as its time. */
	localDate: Date
	input: LogWorkoutInput
	refIds: WorkoutRefIds
}

/** `x1:LEGS` → the ref and the group. */
const GROUP_FIX_SEPARATOR = ':'

/** How one log_workout call changes a session: a new one, a rewrite in place, or an addition. */
@Injectable()
export class WorkoutSessionsService {
	private readonly logger = new Logger(WorkoutSessionsService.name)

	constructor(private readonly workoutsRepository: WorkoutsRepository) {}

	/** The user's fixes of a group: the dictionary row only, the entries keep their snapshots. */
	async applyGroupFixes(
		{ userId, fixes, refIds }: { userId: string; fixes: string[]; refIds: WorkoutRefIds },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		for (const fix of fixes) {
			const [ref = '', group] = fix.split(GROUP_FIX_SEPARATOR)
			// the parser checked the group; a miss is a bug and stops the turn
			const muscleGroup = muscleGroupSchema.safeParse(group)
			if (!muscleGroup.success) throw new WorkoutTurnInconsistentException()
			const id = toId(refIds.exercises, ref)
			await this.workoutsRepository.setExerciseMuscleGroup(
				{ userId, id, muscleGroup: muscleGroup.data },
				tx,
			)
			this.logger.log(`Exercise group fixed user=${userId} exercise=${id}`)
		}
	}

	/** Null when the call only fixes groups, or finishes a session that is gone. */
	writeSession(params: WriteParams, tx: Prisma.TransactionClient): Promise<SessionChange | null> {
		if (params.input.appendRef !== null) return this.appendToSession(params, tx)
		// only group fixes: nothing goes into a session
		if (params.input.exercises.length === 0) return Promise.resolve(null)
		if (params.input.replaceRef !== null) return this.replaceSession(params, tx)
		return this.createSession(params, tx)
	}

	private async createSession(
		params: WriteParams,
		tx: Prisma.TransactionClient,
	): Promise<SessionChange> {
		const workout = await this.workoutsRepository.create(await this.toWrite(params, tx), tx)
		return { workout, recordsBefore: new Set(), messageIds: [] }
	}

	/**
	 * Rewrites the session in place. Each exercise keeps the message (and, the day unchanged, the
	 * time) it was first told in; the finish stays.
	 */
	private async replaceSession(
		params: WriteParams,
		tx: Prisma.TransactionClient,
	): Promise<SessionChange> {
		const { userId, sourceMessageId, input, refIds, now } = params
		const id = toId(refIds.workouts, input.replaceRef ?? '')
		const before = await this.workoutsRepository.findLiveOwned({ userId, id }, tx)
		// deleted by a parallel request after the context was built: the turn rolls back
		if (!before) throw new WorkoutNotFoundException()
		const draft = await this.toWrite(params, tx)
		const isSameDay = input.date === null
		const origins = inheritEntryOrigins({
			oldEntries: before.exercises,
			newExerciseIds: draft.exercises.map(({ exerciseId }) => exerciseId),
			// an exercise new to the session was told by this fix: its card shows on it
			fallback: { sourceMessageId, performedAt: now },
		})
		const write: WorkoutWrite = {
			...draft,
			// a fix keeps the session's day and start; only a named day moves it
			...(isSameDay ? { localDate: before.localDate, startedAt: before.startedAt } : {}),
			exercises: draft.exercises.map((exercise, index) => {
				const origin = origins[index]
				if (origin === undefined) return exercise
				return {
					...exercise,
					sourceMessageId: origin.sourceMessageId,
					performedAt: isSameDay ? origin.performedAt : exercise.performedAt,
				}
			}),
		}
		const replaced = await this.workoutsRepository.replace({ id, write }, tx)
		if (!replaced) throw new WorkoutNotFoundException()
		const { finishedAt, finishedMessageId } = write
		// an open session the fix finishes; a finished one keeps its summary where it is
		const workout =
			before.finishedAt === null && finishedAt !== null && finishedMessageId !== null
				? await this.updateSession({ userId, id, fields: { finishedAt, finishedMessageId } }, tx)
				: replaced
		return {
			workout,
			recordsBefore: getRecordKeys(readWorkoutRecords(before), before.exercises),
			messageIds: [
				...getSessionMessageIds(before),
				...getSessionMessageIds(workout),
				...(before.sourceMessageId === null ? [] : [before.sourceMessageId]),
			],
		}
	}

	/**
	 * Adds the exercises to the session, or starts a new one when it is gone, more than 3 h old or
	 * at another named place. A named place, duration or kcal overwrites the session's.
	 */
	private async appendToSession(
		params: WriteParams,
		tx: Prisma.TransactionClient,
	): Promise<SessionChange | null> {
		const { userId, sourceMessageId, now, input, refIds } = params
		const id = toId(refIds.workouts, input.appendRef ?? '')
		const before = await this.workoutsRepository.findOwned({ userId, id }, tx)
		const reason = getNewSessionReason({ workout: before, place: input.place, now })
		if (reason !== null || before === null) {
			this.logger.log(`Workout append cannot go on user=${userId} workout=${id} reason=${reason}`)
			// a finish alone has nothing to start a session with: it closes what is still open
			if (input.exercises.length === 0) {
				return before === null
					? null
					: this.closeOpenSession(
							params,
							{ workoutId: id, localDate: before.localDate, reason },
							tx,
						)
			}
			return this.createSession(params, tx)
		}
		const exercises = await this.toExerciseWrites(
			// positions after the session's rows are set by the repository, in the write
			{ userId, refIds, exercises: input.exercises, performedAt: now, firstPosition: 0 },
			tx,
		)
		const fields: SessionFields = {
			...(input.place === null ? {} : { place: input.place }),
			...(input.durationMin === null ? {} : { durationMin: input.durationMin }),
			...(input.kcalBurned === null ? {} : { kcalBurned: input.kcalBurned }),
			...(input.finish
				? {
						finishedAt: getFinishedAt({
							workout: before,
							addsExercises: exercises.length > 0,
							now,
						}),
						finishedMessageId: sourceMessageId,
					}
				: {}),
		}
		if (Object.keys(fields).length > 0) await this.updateSession({ userId, id, fields }, tx)
		const workout =
			exercises.length === 0
				? await this.workoutsRepository.findLiveOwned({ userId, id }, tx)
				: await this.workoutsRepository.appendExercises(
						{
							id,
							// the session's day, even when it is added to after midnight
							append: { userId, localDate: before.localDate, sourceMessageId, exercises },
						},
						tx,
					)
		if (!workout) throw new WorkoutNotFoundException()
		// a second finish moves the summary: the message that held it loses its card
		const movedSummary =
			input.finish && before.finishedMessageId !== sourceMessageId ? before.finishedMessageId : null
		return {
			workout,
			recordsBefore: getRecordKeys(readWorkoutRecords(before), before.exercises),
			messageIds: movedSummary === null ? [] : [movedSummary],
		}
	}

	/**
	 * «все» for a session that cannot go on: the last open session of its day is finished at its own
	 * last entry (not now, which would stretch its duration), with the summary on this message.
	 */
	private async closeOpenSession(
		{ userId, sourceMessageId }: WriteParams,
		{ workoutId, localDate, reason }: { workoutId: string; localDate: Date; reason: string | null },
		tx: Prisma.TransactionClient,
	): Promise<SessionChange | null> {
		const session = findSessionToClose(
			await this.workoutsRepository.findOfDay({ userId, localDate }, tx),
		)
		const finishedAt = session === null ? null : getLastPerformedAt(session)
		if (session === null || finishedAt === null) {
			this.logger.log(
				`Workout finish found no open session user=${userId} workout=${workoutId} reason=${reason}`,
			)
			return null
		}
		const workout = await this.updateSession(
			{ userId, id: session.id, fields: { finishedAt, finishedMessageId: sourceMessageId } },
			tx,
		)
		return {
			workout,
			recordsBefore: getRecordKeys(readWorkoutRecords(session), session.exercises),
			messageIds: [],
		}
	}

	/** Writes the named session fields (the finish among them) and reads the session back. */
	private async updateSession(
		{ userId, id, fields }: { userId: string; id: string; fields: SessionFields },
		tx: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises> {
		const isLive = await this.workoutsRepository.updateSessionFields({ userId, id, fields }, tx)
		const workout = isLive ? await this.workoutsRepository.findLiveOwned({ userId, id }, tx) : null
		// deleted by a parallel request after the context was built: the turn rolls back
		if (!workout) throw new WorkoutNotFoundException()
		return workout
	}

	/** A new session from one call; told for another day, it is finished by the same message. */
	private async toWrite(
		{ userId, sourceMessageId, now, localDate, input, refIds }: WriteParams,
		tx: Prisma.TransactionClient,
	): Promise<WorkoutWrite> {
		const day = input.date === null ? localDate : new Date(`${input.date}T00:00:00Z`)
		this.assertLoggableDay(userId, formatDbDate(day), formatDbDate(localDate))
		const isToday = day.getTime() === localDate.getTime()
		const isFinished = input.finish || !isToday
		return {
			userId,
			localDate: day,
			startedAt: isToday ? now : null,
			durationMin: input.durationMin,
			place: input.place,
			kcalBurned: input.kcalBurned,
			sourceMessageId,
			finishedAt: isFinished ? now : null,
			finishedMessageId: isFinished ? sourceMessageId : null,
			exercises: await this.toExerciseWrites(
				{
					userId,
					refIds,
					exercises: input.exercises,
					// another day has no clock time of its own: the middle of the day keeps it in that day
					performedAt: isToday ? now : getNoon(day),
					firstPosition: 0,
				},
				tx,
			),
		}
	}

	private async toExerciseWrites(
		{
			userId,
			refIds,
			exercises,
			performedAt,
			firstPosition,
		}: {
			userId: string
			refIds: WorkoutRefIds
			exercises: LogWorkoutInput['exercises']
			performedAt: Date
			firstPosition: number
		},
		tx: Prisma.TransactionClient,
	): Promise<ExerciseWrite[]> {
		const writes: ExerciseWrite[] = []
		for (const [index, exercise] of exercises.entries()) {
			const { exerciseId, muscleGroup } = await this.resolveExercise(
				{ userId, exercise, refIds },
				tx,
			)
			writes.push({
				exerciseId,
				name: exercise.name,
				kind: exercise.kind,
				muscleGroup,
				position: firstPosition + index,
				durationMin: exercise.durationMin,
				distanceM: toDistanceM(exercise.distanceKm),
				performedAt,
				sets: expandSets(exercise),
			})
		}
		return writes
	}

	private assertLoggableDay(userId: string, day: string, today: string): void {
		const offset = getDayOffset(day, today)
		if (offset >= -ENTRY_BACKDATE_MAX_DAYS && offset <= 0) return
		this.logger.error(`Workout day out of range user=${userId}`)
		throw new WorkoutDateOutOfRangeException()
	}

	/**
	 * The dictionary row of the exercise (the ref the model gave, the same name, or a new one) and the
	 * group the entry keeps as its snapshot: the row's, else the dictionary of names, else the model's.
	 * A row without a group gets that one.
	 */
	private async resolveExercise(
		{
			userId,
			exercise,
			refIds,
		}: {
			userId: string
			exercise: LogWorkoutInput['exercises'][number]
			refIds: WorkoutRefIds
		},
		tx: Prisma.TransactionClient,
	): Promise<{ exerciseId: string; muscleGroup: MuscleGroup | null }> {
		const row = await this.findOrCreateExercise({ userId, exercise, refIds }, tx)
		if (exercise.kind === 'CARDIO') return { exerciseId: row.id, muscleGroup: null }
		if (row.muscleGroup !== null) return { exerciseId: row.id, muscleGroup: row.muscleGroup }
		const matched =
			matchMuscleGroup(row.name) ?? matchMuscleGroup(exercise.name) ?? exercise.muscleGroup
		if (matched !== null && row.kind !== 'CARDIO') {
			await this.workoutsRepository.fillExerciseMuscleGroup(
				{ userId, id: row.id, muscleGroup: matched },
				tx,
			)
		}
		return { exerciseId: row.id, muscleGroup: matched }
	}

	private async findOrCreateExercise(
		{
			userId,
			exercise,
			refIds,
		}: {
			userId: string
			exercise: LogWorkoutInput['exercises'][number]
			refIds: WorkoutRefIds
		},
		tx: Prisma.TransactionClient,
	): Promise<ExerciseRow> {
		if (exercise.exerciseRef !== null) {
			const id = toId(refIds.exercises, exercise.exerciseRef)
			const [row] = await this.workoutsRepository.findExercisesByIds({ userId, ids: [id] }, tx)
			// deleted from the dictionary after the context was built: the entry still points at it
			return row ?? { id, name: exercise.name, kind: exercise.kind, muscleGroup: null }
		}
		const nameNormalized = normalizeExerciseName(exercise.name)
		const known = await this.workoutsRepository.findExerciseByName({ userId, nameNormalized }, tx)
		if (known) return known
		return this.workoutsRepository.createExercise(
			{ userId, name: exercise.name, nameNormalized, kind: exercise.kind },
			tx,
		)
	}

	/**
	 * Compares the workout with the other ones: a heavier set, a longer distance or (without weight)
	 * more reps is a record.
	 */
	async saveRecords(
		userId: string,
		workout: WorkoutWithExercises,
		tx: Prisma.TransactionClient,
	): Promise<WorkoutRecord[]> {
		const records: WorkoutRecord[] = []
		for (const exercise of workout.exercises) {
			if (exercise.exerciseId === null) continue
			const key = { userId, exerciseId: exercise.exerciseId, exceptWorkoutId: workout.id }
			const heaviest = Math.max(
				0,
				...exercise.sets.flatMap((set) =>
					!set.isWarmup && set.weightKg !== null ? [set.weightKg.toNumber()] : [],
				),
			)
			if (
				heaviest > 0 &&
				isRecord(await this.workoutsRepository.findMaxWeightKg(key, tx), heaviest)
			) {
				records.push({ exerciseEntryId: exercise.id, type: 'WEIGHT' })
			}
			if (isRecord(await this.workoutsRepository.findMaxDistanceM(key, tx), exercise.distanceM)) {
				records.push({ exerciseEntryId: exercise.id, type: 'DISTANCE' })
			}
			const reps = getBodyweightMaxReps(exercise.sets)
			if (reps !== null && isRecord(await this.workoutsRepository.findMaxReps(key, tx), reps)) {
				records.push({ exerciseEntryId: exercise.id, type: 'REPS' })
			}
		}
		await this.workoutsRepository.setRecords({ id: workout.id, records }, tx)
		return records
	}
}

const NOON_HOUR = 12
const MS_IN_HOUR = 60 * 60 * 1000

const getNoon = (day: Date): Date => new Date(day.getTime() + NOON_HOUR * MS_IN_HOUR)
