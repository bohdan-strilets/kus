import { Injectable } from '@nestjs/common'
import type { LiveExerciseInput, LiveWorkoutResponse, LiveWorkoutUpdate } from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { ChatWorkoutSummaryService } from '../chat/chat-workout-summary.service'
import { LiveSessionsService } from '../workouts/live-sessions.service'
import { WorkoutNotFoundException } from '../workouts/workouts.exceptions'
import { LiveWorkoutsService } from './live-workouts.service'
import { LoggedExercisesService, type ResolvedExercise } from './logged-exercises.service'
import {
	WorkoutLiveConflictException,
	WorkoutLoggingFieldException,
} from './workout-logging.exceptions'
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

/**
 * PUT of the live mode: the whole part of the session the live screen leads, written idempotently
 * by each exercise's key. The chat's exercises of the same session stay as they are.
 */
@Injectable()
export class LiveSnapshotService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly repository: WorkoutLoggingRepository,
		private readonly liveSessions: LiveSessionsService,
		private readonly loggedExercises: LoggedExercisesService,
		private readonly liveWorkouts: LiveWorkoutsService,
		private readonly summary: ChatWorkoutSummaryService,
	) {}

	async update(
		userId: string,
		id: string,
		{ knownEditedAt, exercises }: LiveWorkoutUpdate,
	): Promise<LiveWorkoutResponse> {
		const keys = exercises.map(({ clientKey }) => clientKey)
		if (new Set(keys).size !== keys.length) {
			throw new WorkoutLoggingFieldException('exercises', 'DUPLICATE')
		}
		const now = new Date()
		// a session left alone for more than 3 h is closed first: a stale offline snapshot never
		// brings it back
		const closed = await this.summary.closeIdleLive({ userId, now })
		if (closed?.workoutId === id) throw new WorkoutLiveConflictException('FINISHED')
		await this.prisma.$transaction(async (tx) => {
			const isLocked = await this.repository.lockOpenLive(
				{ userId, id, knownEditedAt: knownEditedAt === null ? null : new Date(knownEditedAt) },
				tx,
			)
			if (!isLocked) await this.throwWhyNotOpen(userId, id, tx)
			const workout = await this.liveSessions.findOwnedLive(userId, id, tx)
			if (!workout) throw new WorkoutNotFoundException()
			const resolved = await this.loggedExercises.resolve(
				{ userId, templateId: workout.templateId, exercises },
				tx,
			)
			const known = await this.repository.findLivePerformedAt({ userId, workoutId: id, keys }, tx)
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
				{ userId, workoutId: id, keepKeys: keys },
				tx,
			)
			await this.repository.upsertLiveExercises(
				{ userId, workoutId: id, localDate: workout.localDate, exercises: writes },
				tx,
			)
		})
		const workout = await this.liveSessions.findOwnedLive(userId, id)
		if (!workout) throw new WorkoutNotFoundException()
		return this.liveWorkouts.toLiveResponse(userId, workout)
	}

	/** Why the lock failed: gone (404), finished (409 FINISHED) or replaced by the chat (409 EDITED). */
	private async throwWhyNotOpen(
		userId: string,
		id: string,
		tx: Prisma.TransactionClient,
	): Promise<never> {
		const workout = await this.liveSessions.findOwnedLive(userId, id, tx)
		if (!workout) throw new WorkoutNotFoundException()
		if (workout.finishedAt !== null) throw new WorkoutLiveConflictException('FINISHED')
		throw new WorkoutLiveConflictException('EDITED')
	}
}
