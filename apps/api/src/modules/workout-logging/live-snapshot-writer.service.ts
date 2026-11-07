import { Injectable } from '@nestjs/common'
import type { LiveExerciseInput } from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import type { WorkoutWithExercises } from '../workouts/workouts.repository'
import { LoggedExercisesService, type ResolvedExercise } from './logged-exercises.service'
import { WorkoutLoggingFieldException } from './workout-logging.exceptions'
import { type LiveExerciseWrite, WorkoutLoggingRepository } from './workout-logging.repository'

/**
 * A phone's clock is not the server's: a set is done no earlier than the session started and no
 * later than now.
 */
const toDoneAt = (
	doneAt: string | null,
	{ startedAt, now }: { startedAt: Date | null; now: Date },
): Date | null => {
	if (doneAt === null) return null
	const date = new Date(doneAt)
	if (date > now) return now
	return startedAt !== null && date < startedAt ? startedAt : date
}

const toLiveWrite = (
	exercise: LiveExerciseInput,
	{ exerciseId, muscleGroup }: ResolvedExercise,
	{
		position,
		now,
		startedAt,
		knownPerformedAt,
	}: {
		position: number
		now: Date
		startedAt: Date | null
		/** The row's time when it is already written; undefined for a new one. */
		knownPerformedAt: Date | undefined
	},
): LiveExerciseWrite => {
	const sets = exercise.sets.map((set, index) => ({
		position: index,
		reps: set.reps,
		weightKg: set.weightKg,
		durationSec: set.durationSec,
		distanceM: set.distanceM,
		isWarmup: set.isWarmup,
		doneAt: toDoneAt(set.doneAt, { startedAt, now }),
	}))
	const doneTimes = sets.flatMap(({ doneAt }) => (doneAt === null ? [] : [doneAt.getTime()]))
	const firstDoneAt = doneTimes.length === 0 ? null : new Date(Math.min(...doneTimes))
	return {
		exerciseId,
		name: exercise.name,
		kind: exercise.kind,
		muscleGroup,
		position,
		durationMin: exercise.durationMin,
		distanceM: exercise.distanceM,
		// a new exercise happened at its first set done, none done yet: now
		performedAt: firstDoneAt ?? now,
		// a written one keeps its time; only an earlier first set moves it back
		performedAtOnUpdate:
			knownPerformedAt !== undefined && firstDoneAt !== null && firstDoneAt < knownPerformedAt
				? firstDoneAt
				: null,
		clientKey: exercise.clientKey,
		templateExerciseId: exercise.templateExerciseId,
		isBodyweight: exercise.isBodyweight,
		sets,
	}
}

/** One clientKey per exercise: the upsert key of the snapshot. */
export const assertUniqueClientKeys = (exercises: readonly LiveExerciseInput[]): void => {
	const keys = exercises.map(({ clientKey }) => clientKey)
	if (new Set(keys).size !== keys.length) {
		throw new WorkoutLoggingFieldException('exercises', 'DUPLICATE')
	}
}

/**
 * Writes the live snapshot into an already locked open session, idempotently by each exercise's
 * key. The one implementation of PUT and of a finish that brings its snapshot.
 */
@Injectable()
export class LiveSnapshotWriterService {
	constructor(
		private readonly repository: WorkoutLoggingRepository,
		private readonly loggedExercises: LoggedExercisesService,
	) {}

	/** Returns the clamped `doneAt` of every set the snapshot marks done. */
	async writeSnapshot(
		{
			userId,
			workout,
			exercises,
			now,
		}: {
			userId: string
			workout: WorkoutWithExercises
			exercises: readonly LiveExerciseInput[]
			now: Date
		},
		tx: Prisma.TransactionClient,
	): Promise<Date[]> {
		assertUniqueClientKeys(exercises)
		const keys = exercises.map(({ clientKey }) => clientKey)
		const resolved = await this.loggedExercises.resolve(
			{ userId, templateId: workout.templateId, exercises },
			tx,
		)
		const known = await this.repository.findLivePerformedAt(
			{ userId, workoutId: workout.id, keys },
			tx,
		)
		const writes = exercises.flatMap((exercise, position) => {
			const row = resolved[position]
			const timing = {
				position,
				now,
				startedAt: workout.startedAt,
				knownPerformedAt: known.get(exercise.clientKey),
			}
			return row ? [toLiveWrite(exercise, row, timing)] : []
		})
		await this.repository.deleteMissingLiveExercises(
			{ userId, workoutId: workout.id, keepKeys: keys },
			tx,
		)
		await this.repository.upsertLiveExercises(
			{ userId, workoutId: workout.id, localDate: workout.localDate, exercises: writes },
			tx,
		)
		return writes.flatMap(({ sets }) =>
			sets.flatMap(({ doneAt }) => (doneAt === null ? [] : [doneAt])),
		)
	}
}
