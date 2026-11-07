import { Injectable, Logger } from '@nestjs/common'

import type { Prisma } from '../../generated/prisma/client'
import { getLiveFinishFields, hasDoneWork, isLiveIdle } from './live-session'
import { LiveSessionsRepository } from './live-sessions.repository'
import { getRecordExerciseIds } from './workout-records'
import { WorkoutRecordsService } from './workout-records.service'
import { getRecordKeys, hasNewRecord } from './workout-session'
import type { WorkoutRecord } from './workout-turn'
import { WorkoutNotFoundException } from './workouts.exceptions'
import { readWorkoutRecords } from './workouts.mapper'
import { type WorkoutWithExercises, WorkoutsRepository } from './workouts.repository'

/** A live session just finished, before its summary message is written. */
export interface FinishedLive {
	workout: WorkoutWithExercises
	records: WorkoutRecord[]
	/** A record the session did not hold before the finish: the sound. */
	hasNewRecord: boolean
}

/** What a close did: removed a session with nothing done, or finished one that has work in it. */
export type LiveFinish =
	{ kind: 'DELETED'; workoutId: string } | ({ kind: 'FINISHED' } & FinishedLive)

/**
 * The open live session (source = LIVE) as the chat and the live mode both see it: found, finished
 * and closed when left alone. The summary message is the chat's (ChatWorkoutSummaryService).
 */
@Injectable()
export class LiveSessionsService {
	private readonly logger = new Logger(LiveSessionsService.name)

	constructor(
		private readonly liveSessionsRepository: LiveSessionsRepository,
		private readonly workoutsRepository: WorkoutsRepository,
		private readonly records: WorkoutRecordsService,
	) {}

	findOpen(userId: string, tx?: Prisma.TransactionClient): Promise<WorkoutWithExercises | null> {
		return this.liveSessionsRepository.findOpenLiveSession({ userId }, tx)
	}

	/** The owner's not deleted live-mode session (open or finished); null for another's or a chat one. */
	async findOwnedLive(
		userId: string,
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises | null> {
		const workout = await this.workoutsRepository.findLiveOwned({ userId, id }, tx)
		return workout?.source === 'LIVE' ? workout : null
	}

	/** The owner's live-mode session, deleted or not; null for another's or a chat or form one. */
	async findOwnedLiveAnyState(
		userId: string,
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises | null> {
		const workout = await this.workoutsRepository.findOwned({ userId, id }, tx)
		return workout?.source === 'LIVE' ? workout : null
	}

	/**
	 * Before any close (the live mode, the auto-close, a «все» in the chat): locks the open session,
	 * drops what was only planned, and reads it back. With nothing done it is soft-deleted (no
	 * summary) unless `keepEmpty` (the closing message adds exercises itself). Null when it is not
	 * open any more (a parallel request).
	 */
	async prepareClose(
		{ userId, id, keepEmpty = false }: { userId: string; id: string; keepEmpty?: boolean },
		tx: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises | 'DELETED' | null> {
		// the lock matches only an open session with source = LIVE: a chat or form session never
		// reaches the cleanup below
		if (!(await this.liveSessionsRepository.lockOpenLiveSession({ userId, id }, tx))) return null
		await this.liveSessionsRepository.deleteUndoneLiveWork({ userId, workoutId: id }, tx)
		const workout = await this.workoutsRepository.findLiveOwned({ userId, id }, tx)
		if (workout?.source !== 'LIVE') return null
		if (keepEmpty || hasDoneWork(workout)) return workout
		await this.liveSessionsRepository.softDeleteOpenLive({ userId, id }, tx)
		this.logger.log(`Live workout removed user=${userId} workout=${id} reason=empty`)
		return 'DELETED'
	}

	/**
	 * Finishes the open session with its duration and records, counted after the planned sets are
	 * dropped; an empty one is soft-deleted instead. Null when a parallel request finished or
	 * deleted it first.
	 */
	async finish(
		{ userId, workout, now }: { userId: string; workout: WorkoutWithExercises; now: Date },
		tx: Prisma.TransactionClient,
	): Promise<LiveFinish | null> {
		const recordsBefore = getRecordKeys(readWorkoutRecords(workout), workout.exercises)
		const prepared = await this.prepareClose({ userId, id: workout.id }, tx)
		if (prepared === null) return null
		if (prepared === 'DELETED') return { kind: 'DELETED', workoutId: workout.id }
		const fields = getLiveFinishFields(prepared, { now })
		const isClaimed = await this.liveSessionsRepository.claimLiveFinish(
			{ userId, id: workout.id, ...fields },
			tx,
		)
		if (!isClaimed) return null
		const finished = await this.workoutsRepository.findLiveOwned({ userId, id: workout.id }, tx)
		if (!finished) throw new WorkoutNotFoundException()
		const recomputed = await this.records.recompute(
			userId,
			getRecordExerciseIds(finished.exercises),
			tx,
		)
		const records = recomputed.get(finished.id) ?? []
		return {
			kind: 'FINISHED',
			workout: finished,
			records,
			hasNewRecord: hasNewRecord(recordsBefore, getRecordKeys(records, finished.exercises)),
		}
	}

	/**
	 * The open session left alone for more than `maxGapHours` (default WORKOUT_APPEND_MAX_GAP_HOURS)
	 * since its last action: without done work it is soft-deleted, with it it is finished (at its
	 * last set). Null when there is none, it is still going on, or a parallel request closed it.
	 */
	async closeIfIdle(
		{ userId, now, maxGapHours }: { userId: string; now: Date; maxGapHours?: number },
		tx: Prisma.TransactionClient,
	): Promise<LiveFinish | null> {
		const open = await this.liveSessionsRepository.findOpenLiveSession({ userId }, tx)
		if (!open || !isLiveIdle(open, now, maxGapHours)) return null
		const closed = await this.finish({ userId, workout: open, now }, tx)
		if (closed?.kind === 'FINISHED') {
			this.logger.log(`Idle live workout closed user=${userId} workout=${open.id} reason=idle`)
		}
		return closed
	}

	/** Binds the summary message and reads the session back with its records. */
	async setFinishedMessage(
		{ userId, id, messageId }: { userId: string; id: string; messageId: string },
		tx: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises> {
		await this.liveSessionsRepository.setFinishedMessage({ userId, id, messageId }, tx)
		const workout = await this.workoutsRepository.findLiveOwned({ userId, id }, tx)
		if (!workout) throw new WorkoutNotFoundException()
		return workout
	}

	/** «Вийти без збереження»: false when it is not the owner's open live session. */
	removeOpen(userId: string, id: string): Promise<boolean> {
		return this.liveSessionsRepository.softDeleteOpenLive({ userId, id })
	}
}
