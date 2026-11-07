import { Injectable, Logger } from '@nestjs/common'
import {
	LIVE_CURRENT_GRACE_HOURS,
	type LiveWorkoutFinish,
	type LiveWorkoutResponse,
	type WorkoutDiscarded,
	type WorkoutFinishResponse,
	type WorkoutResponse,
} from '@kus/shared'

import { getLocalDate } from '../../common/time'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { ChatWorkoutSummaryService } from '../chat/chat-workout-summary.service'
import { ProgramTemplateNotFoundException } from '../programs/programs.exceptions'
import { ProgramsService } from '../programs/programs.service'
import { UsersService } from '../users/users.service'
import { clampLiveFinishAt, getLastDoneAt, getLiveFinishedAt } from '../workouts/live-session'
import { LiveSessionsService } from '../workouts/live-sessions.service'
import { WorkoutKcalService } from '../workouts/workout-kcal.service'
import { WorkoutNotFoundException } from '../workouts/workouts.exceptions'
import { readWorkoutRecords } from '../workouts/workouts.mapper'
import type { WorkoutWithExercises } from '../workouts/workouts.repository'
import { assertUniqueClientKeys, LiveSnapshotWriterService } from './live-snapshot-writer.service'
import { WorkoutLiveConflictException } from './workout-logging.exceptions'
import { WorkoutLoggingRepository } from './workout-logging.repository'

const UNIQUE_VIOLATION = 'P2002'

const isUniqueViolation = (error: unknown): boolean =>
	error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION

const DISCARDED: WorkoutDiscarded = { discarded: true }

/** A start answers 201 with a new session, 200 with the one already going on. */
export interface StartedLive {
	response: LiveWorkoutResponse
	isCreated: boolean
}

/** The live mode: one open session per user, kept on the server, finished into the chat. */
@Injectable()
export class LiveWorkoutsService {
	private readonly logger = new Logger(LiveWorkoutsService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly repository: WorkoutLoggingRepository,
		private readonly liveSessions: LiveSessionsService,
		private readonly summary: ChatWorkoutSummaryService,
		private readonly programsService: ProgramsService,
		private readonly usersService: UsersService,
		private readonly kcal: WorkoutKcalService,
		private readonly writer: LiveSnapshotWriterService,
	) {}

	/**
	 * The open session; one left alone for more than LIVE_CURRENT_GRACE_HOURS (not 3 h: a phone
	 * offline for hours still holds sets for the next PUT) is closed first, never by the day.
	 */
	async getCurrent(userId: string): Promise<LiveWorkoutResponse | null> {
		await this.summary.closeIdleLive({
			userId,
			now: new Date(),
			maxGapHours: LIVE_CURRENT_GRACE_HOURS,
		})
		const open = await this.liveSessions.findOpen(userId)
		return open === null ? null : this.toLiveResponse(userId, open)
	}

	/** Idempotent: a session already going on is returned; two parallel starts make one session. */
	async start(userId: string, { templateId }: { templateId: string | null }): Promise<StartedLive> {
		const now = new Date()
		await this.summary.closeIdleLive({ userId, now })
		const open = await this.liveSessions.findOpen(userId)
		if (open !== null)
			return { response: await this.toLiveResponse(userId, open), isCreated: false }
		if (
			templateId !== null &&
			!(await this.programsService.hasActiveTemplate(userId, templateId))
		) {
			throw new ProgramTemplateNotFoundException()
		}
		const { timezone } = await this.usersService.getMe(userId)
		try {
			const created = await this.repository.createLiveSession({
				userId,
				localDate: getLocalDate(now, timezone),
				startedAt: now,
				templateId,
			})
			this.logger.log(`Live workout started user=${userId} workout=${created.id}`)
			return { response: await this.toLiveResponse(userId, created), isCreated: true }
		} catch (error) {
			// a parallel start won the partial unique index: its session is the answer
			if (!isUniqueViolation(error)) throw error
			const winner = await this.liveSessions.findOpen(userId)
			if (winner === null) throw error
			return { response: await this.toLiveResponse(userId, winner), isCreated: false }
		}
	}

	/**
	 * «Завершити»: finished with its records and a Kusik summary; a second call answers the same.
	 * With no set marked done (nothing from the chat either) the session is soft-deleted without a
	 * summary and the answer is `{ discarded: true }` — again for a repeat on that same session.
	 */
	async finish(
		userId: string,
		id: string,
		body: LiveWorkoutFinish = {},
	): Promise<WorkoutFinishResponse> {
		const { exercises, knownEditedAt, finishedAt } = body
		if (exercises) assertUniqueClientKeys(exercises)
		const now = new Date()
		const posted = await this.prisma.$transaction(async (tx) => {
			const found = await this.liveSessions.findOwnedLiveAnyState(userId, id, tx)
			if (!found) throw new WorkoutNotFoundException()
			if (found.deletedAt !== null) return this.toDiscardedOrThrow(found)
			// already finished: the body is ignored, nothing is written after a finish
			if (found.finishedAt !== null) return null
			const workout =
				exercises === undefined && knownEditedAt === undefined
					? found
					: await this.applySnapshot({ userId, id, body, now }, tx)
			if (workout === null) return null
			// the tap of the phone, never in the future nor before the start or the last set done
			const tap = clampLiveFinishAt({
				requestedAt: finishedAt === undefined ? null : new Date(finishedAt),
				startedAt: workout.startedAt,
				lastDoneAt: getLastDoneAt(workout),
				now,
			})
			// a new cardio row without sets got the write time; it must not outlive the end of the
			// session, or the 30-min rule would see activity after the last set
			if (exercises !== undefined) {
				const lastDoneAt = getLastDoneAt(workout)
				const endsAt =
					lastDoneAt === null
						? tap
						: getLiveFinishedAt({ exercises: [{ performedAt: lastDoneAt }] }, tap)
				await this.repository.capLivePerformedAt({ userId, workoutId: id, at: endsAt }, tx)
			}
			const finished = await this.liveSessions.finish({ userId, workout, now: tap }, tx)
			if (finished === null) return null
			if (finished.kind === 'DELETED') return DISCARDED
			const bound = await this.summary.postSummary({ userId, finished, isAutoClosed: false }, tx)
			return { ...bound, hasNewRecord: finished.hasNewRecord }
		})
		if (posted === null) return this.getFinished(userId, id)
		if ('discarded' in posted) {
			this.logger.log(`Live workout finished empty user=${userId} workout=${id} reason=discarded`)
			return DISCARDED
		}
		this.logger.log(
			`Live workout finished user=${userId} workout=${id} exercises=${posted.workout.exercises.length}`,
		)
		return {
			workout: await this.toWorkoutResponse(userId, posted.workout),
			messageId: posted.messageId,
			hasNewRecord: posted.hasNewRecord,
		}
	}

	/**
	 * The snapshot of a finish, written in the finish's own transaction: the session is locked (with
	 * the edit stamp when it was sent), its exercises written exactly as the PUT does, and read back.
	 * Null when a parallel request finished or deleted it first; 409 EDITED when the chat replaced it.
	 */
	private async applySnapshot(
		{ userId, id, body, now }: { userId: string; id: string; body: LiveWorkoutFinish; now: Date },
		tx: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises | null> {
		const { exercises, knownEditedAt } = body
		// no closeIdleLive before: a late finish of an offline phone keeps its sets
		const isLocked = await this.repository.lockOpenLive(
			{
				userId,
				id,
				knownEditedAt:
					knownEditedAt === undefined || knownEditedAt === null
						? knownEditedAt
						: new Date(knownEditedAt),
			},
			tx,
		)
		if (!isLocked) {
			const current = await this.liveSessions.findOwnedLiveAnyState(userId, id, tx)
			if (!current) throw new WorkoutNotFoundException()
			if (current.deletedAt !== null || current.finishedAt !== null) return null
			throw new WorkoutLiveConflictException('EDITED')
		}
		const locked = await this.liveSessions.findOwnedLive(userId, id, tx)
		if (!locked) throw new WorkoutNotFoundException()
		if (exercises === undefined) return locked
		await this.writer.writeSnapshot({ userId, workout: locked, exercises, now }, tx)
		const written = await this.liveSessions.findOwnedLive(userId, id, tx)
		if (!written) throw new WorkoutNotFoundException()
		return written
	}

	/** «Вийти без збереження»: the open session is soft-deleted; a finished one stays. */
	async remove(userId: string, id: string): Promise<void> {
		if (!(await this.liveSessions.removeOpen(userId, id))) throw new WorkoutNotFoundException()
		this.logger.log(`Live workout discarded user=${userId} workout=${id}`)
	}

	/** The session with what the live screen needs: `editedAt` to send back, the plan, the hints. */
	async toLiveResponse(
		userId: string,
		workout: WorkoutWithExercises,
	): Promise<LiveWorkoutResponse> {
		const [response, plan] = await Promise.all([
			this.toWorkoutResponse(userId, workout),
			workout.templateId === null
				? Promise.resolve(null)
				: this.programsService.getTemplatePlan(userId, workout.templateId),
		])
		return {
			workout: response,
			editedAt: workout.editedAt?.toISOString() ?? null,
			templateName: workout.template?.name ?? null,
			plan: plan?.exercises ?? [],
		}
	}

	/** The answer of a finish that already happened (here, in the chat or by the auto-close). */
	private async getFinished(userId: string, id: string): Promise<WorkoutFinishResponse> {
		const workout = await this.liveSessions.findOwnedLiveAnyState(userId, id)
		if (!workout) throw new WorkoutNotFoundException()
		// a parallel «Завершити» removed it as empty
		if (workout.deletedAt !== null) return this.toDiscardedOrThrow(workout)
		const messageId =
			workout.finishedMessageId === null
				? null
				: await this.summary.findSummaryMessageId(userId, workout.finishedMessageId)
		if (workout.finishedAt === null || messageId === null) {
			throw new WorkoutLiveConflictException('FINISHED')
		}
		return {
			workout: await this.toWorkoutResponse(userId, workout),
			messageId,
			hasNewRecord: readWorkoutRecords(workout).length > 0,
		}
	}

	/**
	 * A deleted live session never finished was discarded (empty finish, «Вийти без збереження» or
	 * the auto-close of an empty one); a deleted finished one is gone: 404.
	 */
	private toDiscardedOrThrow(workout: WorkoutWithExercises): WorkoutDiscarded {
		if (workout.finishedAt !== null) throw new WorkoutNotFoundException()
		return DISCARDED
	}

	private async toWorkoutResponse(
		userId: string,
		workout: WorkoutWithExercises,
	): Promise<WorkoutResponse> {
		const [response] = await this.kcal.toResponses(userId, [workout])
		if (!response) throw new WorkoutNotFoundException()
		return response
	}
}
