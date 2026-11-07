import { Injectable, Logger } from '@nestjs/common'
import {
	isWorkoutOpen,
	LIVE_CURRENT_GRACE_HOURS,
	type LiveExerciseInput,
	type LiveWorkoutResponse,
	type LiveWorkoutUpdate,
} from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { ChatWorkoutSummaryService } from '../chat/chat-workout-summary.service'
import { getLastActionAtWith } from '../workouts/live-session'
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
	private readonly logger = new Logger(LiveSnapshotService.name)

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
		// a session idle for more than the grace period is closed first: a snapshot that old never
		// brings it back. A younger one takes the snapshot first and is judged with it (below)
		const closed = await this.summary.closeIdleLive({
			userId,
			now,
			maxGapHours: LIVE_CURRENT_GRACE_HOURS,
		})
		if (closed?.workoutId === id) throw new WorkoutLiveConflictException('FINISHED')
		const outcome = await this.prisma.$transaction(
			async (tx): Promise<'OPEN' | 'CLOSED' | 'DELETED'> => {
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
				// the snapshot's own sets count, the performedAt this write gives a new row does not.
				// The stored state is read before the delete: an exercise missing from the snapshot
				// still counts as activity (rare, it only keeps the session open longer)
				const lastActionAt = getLastActionAtWith(
					workout,
					writes.flatMap(({ sets }) =>
						sets.flatMap(({ doneAt }) => (doneAt === null ? [] : [doneAt])),
					),
				)
				await this.repository.deleteMissingLiveExercises(
					{ userId, workoutId: id, keepKeys: keys },
					tx,
				)
				await this.repository.upsertLiveExercises(
					{ userId, workoutId: id, localDate: workout.localDate, exercises: writes },
					tx,
				)
				if (lastActionAt !== null && isWorkoutOpen(lastActionAt, now)) return 'OPEN'
				// the user worked offline and stopped long ago: finish at the last done set
				const written = await this.liveSessions.findOwnedLive(userId, id, tx)
				if (!written) throw new WorkoutNotFoundException()
				const idleClosed = await this.summary.closeLive(
					{ userId, workout: written, activityAt: lastActionAt ?? now },
					tx,
				)
				if (idleClosed === null) throw new WorkoutLiveConflictException('FINISHED')
				this.logger.log(`Offline snapshot closed idle user=${userId} workout=${id}`)
				return idleClosed.messageId === null ? 'DELETED' : 'CLOSED'
			},
		)
		// nothing was done in it: removed as empty, like the auto-close always did
		if (outcome === 'DELETED') throw new WorkoutLiveConflictException('FINISHED')
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
