import { Injectable, Logger } from '@nestjs/common'
import {
	ENTRY_BACKDATE_MAX_DAYS,
	getDayOffset,
	type LogWorkoutInput,
	matchMuscleGroup,
	muscleGroupSchema,
} from '@kus/shared'

import { formatDbDate } from '../../common/time'
import type { Prisma } from '../../generated/prisma/client'
import type { MuscleGroup } from '../../generated/prisma/enums'
import { isSameExercise } from './exercise-names'
import { toId, type WorkoutRefIds } from './workout-refs'
import {
	findSessionToClose,
	getFinishedAt,
	getNewSessionReason,
	getRecordKeys,
	getSessionMessageIds,
	inheritEntryOrigins,
} from './workout-session'
import { getLiveFinishFields, isLiveIdle, isOpenLive } from './live-session'
import { LiveSessionsService } from './live-sessions.service'
import { expandSets, getLastPerformedAt, toDistanceM } from './workout-turn'
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
import { type ExerciseRow, WorkoutsService } from './workouts.service'

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
	/** The program template the call binds to, checked by the chat; null when none or unknown. */
	templateId: string | null
}

/** `x1:LEGS` → the ref and the group. */
const GROUP_FIX_SEPARATOR = ':'

/** How one log_workout call changes a session: a new one, a rewrite in place, or an addition. */
@Injectable()
export class WorkoutSessionsService {
	private readonly logger = new Logger(WorkoutSessionsService.name)

	constructor(
		private readonly workoutsRepository: WorkoutsRepository,
		private readonly workoutsService: WorkoutsService,
		private readonly liveSessions: LiveSessionsService,
	) {}

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
	async writeSession(
		params: WriteParams,
		tx: Prisma.TransactionClient,
	): Promise<SessionChange | null> {
		const { input, refIds } = params
		if (input.appendRef !== null) {
			return this.appendToSession(params, toId(refIds.workouts, input.appendRef), tx)
		}
		const live = await this.findLiveToJoin(params, tx)
		if (live !== null) return this.appendToSession(params, live, tx)
		// only group fixes: nothing goes into a session
		if (input.exercises.length === 0) return null
		if (input.replaceRef !== null) return this.replaceSession(params, tx)
		return this.createSession(params, tx)
	}

	/**
	 * A call without a ref goes into the open live session (exercises, or a «все» closing it) while
	 * its last action is at most WORKOUT_APPEND_MAX_GAP_HOURS old, whatever the calendar day says.
	 * Not a replace and not a workout of another named day. A «все» alone for a session with nothing
	 * done removes it (no summary) and goes on as if there were none. Null: the call goes its own way.
	 */
	private async findLiveToJoin(
		{ userId, input, now, localDate }: WriteParams,
		tx: Prisma.TransactionClient,
	): Promise<string | null> {
		if (input.replaceRef !== null) return null
		if (input.date !== null && input.date !== formatDbDate(localDate)) return null
		if (input.exercises.length === 0 && !input.finish) return null
		const live = await this.liveSessions.findOpen(userId, tx)
		if (live === null || isLiveIdle(live, now)) return null
		if (input.exercises.length === 0) {
			const prepared = await this.liveSessions.prepareClose({ userId, id: live.id }, tx)
			if (prepared === null || prepared === 'DELETED') return null
		}
		this.logger.log(
			`Workout joins the open live session user=${userId} workout=${live.id} reason=no-ref`,
		)
		return live.id
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
			// a fix keeps the binding unless it names a template itself
			templateId: params.templateId ?? before.templateId,
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
		id: string,
		tx: Prisma.TransactionClient,
	): Promise<SessionChange | null> {
		const { userId, sourceMessageId, now, input, refIds } = params
		const found = await this.workoutsRepository.findOwned({ userId, id }, tx)
		const reason = getNewSessionReason({ workout: found, place: input.place, now })
		if (reason !== null || found === null) {
			this.logger.log(`Workout append cannot go on user=${userId} workout=${id} reason=${reason}`)
			// a finish alone has nothing to start a session with: it closes what is still open
			if (input.exercises.length === 0) {
				return found === null
					? null
					: this.closeOpenSession(params, { workoutId: id, localDate: found.localDate, reason }, tx)
			}
			return this.createSession(params, tx)
		}
		// a «все» for a live session: only what was done stays; with nothing done it goes, no summary
		const prepared =
			input.finish && isOpenLive(found)
				? await this.liveSessions.prepareClose(
						{ userId, id, keepEmpty: input.exercises.length > 0 },
						tx,
					)
				: found
		if (prepared === null || prepared === 'DELETED') return null
		const before = prepared
		const exercises = await this.toExerciseWrites(
			// positions after the session's rows are set by the repository, in the write
			{ userId, refIds, exercises: input.exercises, performedAt: now, firstPosition: 0 },
			tx,
		)
		const fields: SessionFields = {
			...(input.place === null ? {} : { place: input.place }),
			...(input.durationMin === null ? {} : { durationMin: input.durationMin }),
			...(input.kcalBurned === null ? {} : { kcalBurned: input.kcalBurned }),
			// an addition keeps the session's binding unless it names a template; an open live session
			// keeps the template it was started by
			...(params.templateId === null || (isOpenLive(before) && before.templateId !== null)
				? {}
				: { templateId: params.templateId }),
			...(input.finish
				? {
						...this.getFinishFields(before, { addsExercises: exercises.length > 0, input, now }),
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
		params: WriteParams,
		{ workoutId, localDate, reason }: { workoutId: string; localDate: Date; reason: string | null },
		tx: Prisma.TransactionClient,
	): Promise<SessionChange | null> {
		const { userId, sourceMessageId } = params
		const session = findSessionToClose(
			await this.workoutsRepository.findOfDay({ userId, localDate, withOpenLive: true }, tx),
		)
		const finishedAt = session === null ? null : getLastPerformedAt(session)
		if (session === null || finishedAt === null) {
			this.logger.log(
				`Workout finish found no open session user=${userId} workout=${workoutId} reason=${reason}`,
			)
			return null
		}
		// a live session ends by its own rule (its last set) and gets its duration; with nothing done
		// it is removed instead, without a summary
		const prepared = isOpenLive(session)
			? await this.liveSessions.prepareClose({ userId, id: session.id }, tx)
			: session
		if (prepared === null || prepared === 'DELETED') return null
		const finish = isOpenLive(prepared)
			? getLiveFinishFields(prepared, { now: params.now })
			: { finishedAt }
		const workout = await this.updateSession(
			{ userId, id: session.id, fields: { ...finish, finishedMessageId: sourceMessageId } },
			tx,
		)
		return {
			workout,
			recordsBefore: getRecordKeys(readWorkoutRecords(prepared), prepared.exercises),
			messageIds: [],
		}
	}

	/**
	 * When a «все» ends the session: an open live one by its own rule (its last set, its duration
	 * from the start), a chat one at the message or at its last entry (getFinishedAt).
	 */
	private getFinishFields(
		before: WorkoutWithExercises,
		{ addsExercises, input, now }: { addsExercises: boolean; input: LogWorkoutInput; now: Date },
	): Pick<SessionFields, 'finishedAt' | 'durationMin'> {
		if (isOpenLive(before)) {
			return getLiveFinishFields(before, {
				now,
				addsExercises,
				namedDurationMin: input.durationMin,
			})
		}
		return { finishedAt: getFinishedAt({ workout: before, addsExercises, now }) }
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
		{ userId, sourceMessageId, now, localDate, input, refIds, templateId }: WriteParams,
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
			templateId,
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
			if (!row) return { id, name: exercise.name, kind: exercise.kind, muscleGroup: null }
			if (isSameExercise(exercise.name, row)) return row
			// the x-ref is of another exercise than the name says: the name wins
			this.logger.warn(`Exercise ref does not match its name user=${userId} exercise=${id}`)
		}
		// no group here: resolveExercise sets it (names dictionary first, then the model's)
		return this.workoutsService.findOrCreateExercise(
			userId,
			{ name: exercise.name, kind: exercise.kind },
			tx,
		)
	}
}

const NOON_HOUR = 12
const MS_IN_HOUR = 60 * 60 * 1000

const getNoon = (day: Date): Date => new Date(day.getTime() + NOON_HOUR * MS_IN_HOUR)
