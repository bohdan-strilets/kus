import { Injectable } from '@nestjs/common'

import type { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { WITH_EXERCISES, type WorkoutWithExercises } from './workouts.repository'

/** source = LIVE, not finished, not deleted: at most one per user (`workouts_one_open_live`). */
const OPEN_LIVE = {
	source: 'LIVE',
	finishedAt: null,
	deletedAt: null,
} satisfies Prisma.WorkoutWhereInput

/**
 * The open live session of a user. «Live» here is the live mode (source = LIVE), not «not deleted»
 * as in WorkoutsRepository.findLiveOwned. Every query is scoped by `userId`.
 */
@Injectable()
export class LiveSessionsRepository {
	constructor(private readonly prisma: PrismaService) {}

	findOpenLiveSession(
		{ userId }: { userId: string },
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises | null> {
		return (tx ?? this.prisma).workout.findFirst({
			where: { userId, ...OPEN_LIVE },
			include: WITH_EXERCISES,
		})
	}

	/**
	 * Locks the owner's open live session until the transaction ends (a PUT waits behind a close);
	 * false when it is not open any more.
	 */
	async lockOpenLiveSession(
		{ userId, id }: { userId: string; id: string },
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await tx.workout.updateMany({
			where: { id, userId, ...OPEN_LIVE },
			data: { updatedAt: new Date() },
		})
		return count > 0
	}

	/**
	 * Before a close: the live mode's sets that were only planned (no doneAt) go, then its exercises
	 * left with nothing done (no set; cardio also without minutes and distance). Only rows of the
	 * live mode itself (clientKey set, no message): what the chat told, or rewrote by a replaceRef,
	 * stays whole.
	 */
	async deleteUndoneLiveWork(
		{ userId, workoutId }: { userId: string; workoutId: string },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		// the live mode's own rows of a live session only: never a chat or form session, never a row
		// the chat told or rewrote (clientKey null)
		const liveRow = {
			workoutId,
			userId,
			sourceMessageId: null,
			clientKey: { not: null },
			workout: { userId, source: 'LIVE' },
		} satisfies Prisma.ExerciseEntryWhereInput
		await tx.exerciseSet.deleteMany({
			where: { userId, doneAt: null, exerciseEntry: liveRow },
		})
		await tx.exerciseEntry.deleteMany({
			where: {
				...liveRow,
				sets: { none: {} },
				OR: [{ kind: { not: 'CARDIO' } }, { durationMin: null, distanceM: null }],
			},
		})
	}

	/**
	 * Finishes the owner's open live session once: false when it is finished, deleted or not a live
	 * one (a parallel finish got there first and holds the row until it commits).
	 */
	async claimLiveFinish(
		{
			userId,
			id,
			finishedAt,
			durationMin,
		}: { userId: string; id: string; finishedAt: Date; durationMin: number },
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await tx.workout.updateMany({
			where: { id, userId, ...OPEN_LIVE },
			data: { finishedAt, durationMin },
		})
		return count > 0
	}

	/** The Kusik message with the summary card of a finished session. */
	async setFinishedMessage(
		{ userId, id, messageId }: { userId: string; id: string; messageId: string },
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await tx.workout.updateMany({
			where: { id, userId, deletedAt: null },
			data: { finishedMessageId: messageId },
		})
		return count > 0
	}

	/** «Вийти без збереження» and the auto-close of an empty one; false when it is not open. */
	async softDeleteOpenLive(
		{ userId, id }: { userId: string; id: string },
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).workout.updateMany({
			where: { id, userId, ...OPEN_LIVE },
			data: { deletedAt: new Date() },
		})
		return count > 0
	}
}
