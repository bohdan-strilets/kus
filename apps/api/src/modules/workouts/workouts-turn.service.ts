import { Injectable, Logger } from '@nestjs/common'
import {
	ENTRY_BACKDATE_MAX_DAYS,
	type ExerciseContext,
	getDayOffset,
	getOpenWorkoutSince,
	isWorkoutOpen,
	type LogWorkoutInput,
	MAX_CONTEXT_DELETED_WORKOUTS,
	MAX_CONTEXT_EXERCISES,
	matchMuscleGroup,
	normalizeExerciseName,
	type TodayWorkoutContext,
	type WorkoutResponse,
} from '@kus/shared'

import { formatDbDate, formatLocalClock } from '../../common/time'
import type { Prisma } from '../../generated/prisma/client'
import type { ExerciseKind, MuscleGroup } from '../../generated/prisma/enums'
import { isExerciseNamed } from './exercise-names'
import { WorkoutDateOutOfRangeException, WorkoutNotFoundException } from './workouts.exceptions'
import {
	expandSets,
	getBodyweightMaxReps,
	getLastPerformedAt,
	isRecord,
	toDistanceM,
	toExerciseContext,
	toWorkoutContext,
	type WorkoutRecord,
} from './workout-turn'
import { toWorkoutResponse } from './workouts.mapper'
import {
	type ExerciseWrite,
	type WorkoutWithExercises,
	WorkoutsRepository,
	type WorkoutWrite,
} from './workouts.repository'

/** The dictionary rows a message is matched against; a user with more has older ones forgotten. */
const DICTIONARY_SCAN_LIMIT = 300

type ExerciseRow = { id: string; name: string; kind: ExerciseKind; muscleGroup: MuscleGroup | null }

/** Ref → id of what the model saw in this request; nothing else can be changed (IDOR). */
export interface WorkoutRefIds {
	workouts: ReadonlyMap<string, string>
	deletedWorkouts: ReadonlyMap<string, string>
	exercises: ReadonlyMap<string, string>
}

export interface WorkoutsContext {
	workouts: TodayWorkoutContext[]
	deletedWorkouts: TodayWorkoutContext[]
	exercises: ExerciseContext[]
	refIds: WorkoutRefIds
}

export const NO_WORKOUT_REFS: WorkoutRefIds = {
	workouts: new Map(),
	deletedWorkouts: new Map(),
	exercises: new Map(),
}

/** Refs were checked against this same map by the parser; a miss is a bug, not user input. */
const toId = (refIds: ReadonlyMap<string, string>, ref: string): string => {
	const id = refIds.get(ref)
	if (id === undefined) throw new Error(`Workout ref ${ref} is not in the request context`)
	return id
}

/** What a turn does to workouts: the chat's model decisions become rows here. */
@Injectable()
export class WorkoutsTurnService {
	private readonly logger = new Logger(WorkoutsTurnService.name)

	constructor(private readonly workoutsRepository: WorkoutsRepository) {}

	/**
	 * Today's workouts (w1…) with a still open one of the day before first, the ones deleted today,
	 * and the dictionary exercises the text names plus those of the listed workouts.
	 */
	async getContext({
		userId,
		localDate,
		timezone,
		text,
		now,
	}: {
		userId: string
		localDate: Date
		timezone: string
		text: string
		now: Date
	}): Promise<WorkoutsContext> {
		const [ofDay, recent, deleted, dictionary] = await Promise.all([
			this.workoutsRepository.findOfDay({ userId, localDate }),
			this.workoutsRepository.findRecent({
				userId,
				since: getOpenWorkoutSince(now),
			}),
			this.workoutsRepository.findDeletedOfDay({
				userId,
				localDate,
				take: MAX_CONTEXT_DELETED_WORKOUTS,
			}),
			this.workoutsRepository.findDictionary({ userId, take: DICTIONARY_SCAN_LIMIT }),
		])
		const nightBefore = recent.filter((workout) => {
			const last = getLastPerformedAt(workout)
			return workout.localDate < localDate && last !== null && isWorkoutOpen(last, now)
		})
		const active = [...nightBefore, ...ofDay]
		const activeRefs = active.map((workout, index) => ({ workout, ref: `w${index + 1}` }))
		const deletedRefs = deleted.map((workout, index) => ({
			workout,
			ref: `w${active.length + index + 1}`,
		}))

		const sessionExerciseIds = new Set(
			active.flatMap((workout) => workout.exercises.flatMap(({ exerciseId }) => exerciseId ?? [])),
		)
		const listed = [
			...dictionary.filter((exercise) => isExerciseNamed(text, exercise)),
			...dictionary.filter(
				(exercise) => sessionExerciseIds.has(exercise.id) && !isExerciseNamed(text, exercise),
			),
		].slice(0, MAX_CONTEXT_EXERCISES)
		const exerciseRefs = new Map(listed.map((exercise, index) => [exercise.id, `x${index + 1}`]))
		const exercises = await Promise.all(
			listed.map(async (exercise, index) =>
				toExerciseContext(exercise, {
					ref: `x${index + 1}`,
					last: await this.workoutsRepository.findLastResult({
						userId,
						exerciseId: exercise.id,
					}),
				}),
			),
		)
		const toContext = (workout: WorkoutWithExercises, ref: string): TodayWorkoutContext => {
			const last = getLastPerformedAt(workout)
			// a workout of another day has no clock time; its entries sit at noon
			if (workout.startedAt === null) {
				return toWorkoutContext(workout, { ref, time: null, lastAt: null, exerciseRefs })
			}
			return toWorkoutContext(workout, {
				ref,
				time: formatLocalClock(workout.startedAt, timezone),
				lastAt: last === null ? null : formatLocalClock(last, timezone),
				exerciseRefs,
			})
		}
		return {
			workouts: activeRefs.map(({ workout, ref }) => toContext(workout, ref)),
			deletedWorkouts: deletedRefs.map(({ workout, ref }) => toContext(workout, ref)),
			exercises,
			refIds: {
				workouts: new Map(activeRefs.map(({ workout, ref }) => [ref, workout.id])),
				deletedWorkouts: new Map(deletedRefs.map(({ workout, ref }) => [ref, workout.id])),
				exercises: new Map(listed.map((exercise, index) => [`x${index + 1}`, exercise.id])),
			},
		}
	}

	/**
	 * Writes the workouts of a turn. A replaceRef rewrites that workout in place; the message that
	 * first recorded it is returned so its card is refreshed.
	 */
	async logWorkouts(
		{
			userId,
			sourceMessageId,
			now,
			localDate,
			workouts,
			refIds,
		}: {
			userId: string
			sourceMessageId: string
			now: Date
			/** The user's today; a workout of another day gets the middle of it as its time. */
			localDate: Date
			workouts: LogWorkoutInput[]
			refIds: WorkoutRefIds
		},
		tx: Prisma.TransactionClient,
	): Promise<{ sourceMessageIds: string[] }> {
		const sourceMessageIds: string[] = []
		for (const input of workouts) {
			const write = await this.toWrite(
				{ userId, sourceMessageId, now, localDate, input, refIds },
				tx,
			)
			const saved =
				input.replaceRef === null
					? await this.workoutsRepository.create(write, tx)
					: await this.workoutsRepository.replace(
							{ id: toId(refIds.workouts, input.replaceRef), write },
							tx,
						)
			// deleted by a parallel request after the context was built: the turn rolls back
			if (!saved) throw new WorkoutNotFoundException()
			if (input.replaceRef !== null && saved.sourceMessageId !== null) {
				sourceMessageIds.push(saved.sourceMessageId)
			}
			await this.saveRecords(userId, saved, tx)
			this.logger.log(
				`Workout logged user=${userId} workout=${saved.id} exercises=${saved.exercises.length}`,
			)
		}
		return { sourceMessageIds }
	}

	/** Soft-deletes workouts by their refs; the messages whose cards change are returned. */
	async deleteByRefs(
		{ userId, refs, refIds }: { userId: string; refs: string[]; refIds: WorkoutRefIds },
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		return this.flip(
			{ userId, ids: refs.map((ref) => toId(refIds.workouts, ref)), isDeleted: true },
			tx,
		)
	}

	/** Brings workouts deleted today back by their refs. */
	async restoreByRefs(
		{ userId, refs, refIds }: { userId: string; refs: string[]; refIds: WorkoutRefIds },
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		return this.flip(
			{ userId, ids: refs.map((ref) => toId(refIds.deletedWorkouts, ref)), isDeleted: false },
			tx,
		)
	}

	/** The cards of the chat: the workouts each user message recorded. */
	async getByMessages(
		userId: string,
		messageIds: string[],
	): Promise<Map<string, WorkoutResponse[]>> {
		const byMessage = new Map<string, WorkoutResponse[]>()
		if (messageIds.length === 0) return byMessage
		const rows = await this.workoutsRepository.findBySourceMessages({ userId, messageIds })
		for (const row of rows) {
			if (row.sourceMessageId === null) continue
			byMessage.set(row.sourceMessageId, [
				...(byMessage.get(row.sourceMessageId) ?? []),
				toWorkoutResponse(row),
			])
		}
		return byMessage
	}

	private async flip(
		{ userId, ids, isDeleted }: { userId: string; ids: string[]; isDeleted: boolean },
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		const messageIds: string[] = []
		for (const id of ids) {
			const changed = isDeleted
				? await this.workoutsRepository.softDelete({ userId, id }, tx)
				: await this.workoutsRepository.restore({ userId, id }, tx)
			const workout = await this.workoutsRepository.findOwned({ userId, id }, tx)
			if (changed && workout?.sourceMessageId) messageIds.push(workout.sourceMessageId)
		}
		return messageIds
	}

	private async toWrite(
		{
			userId,
			sourceMessageId,
			now,
			localDate,
			input,
			refIds,
		}: {
			userId: string
			sourceMessageId: string
			now: Date
			localDate: Date
			input: LogWorkoutInput
			refIds: WorkoutRefIds
		},
		tx: Prisma.TransactionClient,
	): Promise<WorkoutWrite> {
		const day = input.date === null ? localDate : new Date(`${input.date}T00:00:00Z`)
		this.assertLoggableDay(userId, formatDbDate(day), formatDbDate(localDate))
		const isToday = day.getTime() === localDate.getTime()
		// another day has no clock time of its own: the middle of the day keeps it in that day
		const performedAt = isToday ? now : getNoon(day)
		const exercises: ExerciseWrite[] = []
		for (const [position, exercise] of input.exercises.entries()) {
			const { exerciseId, muscleGroup } = await this.resolveExercise(
				{ userId, exercise, refIds },
				tx,
			)
			exercises.push({
				exerciseId,
				name: exercise.name,
				kind: exercise.kind,
				muscleGroup,
				position,
				durationMin: exercise.durationMin,
				distanceM: toDistanceM(exercise.distanceKm),
				performedAt,
				sets: expandSets(exercise),
			})
		}
		return {
			userId,
			localDate: day,
			startedAt: isToday ? now : null,
			durationMin: input.durationMin,
			place: input.place,
			kcalBurned: input.kcalBurned,
			sourceMessageId,
			exercises,
		}
	}

	private assertLoggableDay(userId: string, day: string, today: string): void {
		const offset = getDayOffset(day, today)
		if (offset >= -ENTRY_BACKDATE_MAX_DAYS && offset <= 0) return
		this.logger.error(`Workout day out of range user=${userId}`)
		throw new WorkoutDateOutOfRangeException()
	}

	/**
	 * The dictionary row of the exercise (the ref the model gave, the same name, or a new one) and the
	 * group the entry keeps as its snapshot. A row without a group gets the dictionary's.
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
		const matched = matchMuscleGroup(row.name) ?? matchMuscleGroup(exercise.name)
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
	private async saveRecords(
		userId: string,
		workout: WorkoutWithExercises,
		tx: Prisma.TransactionClient,
	): Promise<void> {
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
	}
}

const NOON_HOUR = 12
const MS_IN_HOUR = 60 * 60 * 1000

const getNoon = (day: Date): Date => new Date(day.getTime() + NOON_HOUR * MS_IN_HOUR)
