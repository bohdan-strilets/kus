import { Injectable } from '@nestjs/common'

import type { MyFood, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import type { NewMyFood } from './my-foods.utils'

/** Upper bound for the in-memory match; far above a real user's list. */
const MAX_FOODS_SCANNED = 500

@Injectable()
export class MemoryRepository {
	constructor(private readonly prisma: PrismaService) {}

	findActiveFoods(userId: string): Promise<MyFood[]> {
		return this.prisma.myFood.findMany({
			where: { userId, deletedAt: null },
			orderBy: [{ usageCount: 'desc' }, { lastUsedAt: { sort: 'desc', nulls: 'last' } }],
			take: MAX_FOODS_SCANNED,
		})
	}

	/** Active or deleted, but always the user's own. */
	findFood(
		{ userId, id }: { userId: string; id: string },
		tx?: Prisma.TransactionClient,
	): Promise<MyFood | null> {
		return (tx ?? this.prisma).myFood.findFirst({ where: { id, userId } })
	}

	findActiveFoodByName(
		{ userId, nameNormalized }: { userId: string; nameNormalized: string },
		tx?: Prisma.TransactionClient,
	): Promise<MyFood | null> {
		return (tx ?? this.prisma).myFood.findFirst({
			where: { userId, nameNormalized, deletedAt: null },
		})
	}

	/** Foods the user messages saved, deleted ones too: what the model's history says about them. */
	findBySourceMessages({
		userId,
		messageIds,
	}: {
		userId: string
		messageIds: string[]
	}): Promise<MyFood[]> {
		return this.prisma.myFood.findMany({
			where: { userId, sourceMessageId: { in: messageIds } },
			orderBy: { createdAt: 'asc' },
		})
	}

	/** Active or deleted foods by id, always the user's own: what the history says about them. */
	findFoodsByIds({ userId, ids }: { userId: string; ids: string[] }): Promise<MyFood[]> {
		return this.prisma.myFood.findMany({ where: { userId, id: { in: ids } } })
	}

	createFood(
		{ userId, data }: { userId: string; data: NewMyFood },
		tx: Prisma.TransactionClient,
	): Promise<MyFood> {
		return tx.myFood.create({ data: { ...data, userId } })
	}

	/**
	 * Conflict-safe insert for the chat turn: ON CONFLICT DO NOTHING honours the partial unique
	 * index, while a violation would abort the turn's transaction. null = the name is taken.
	 */
	async createFoodIfFree(
		{
			userId,
			data,
			sourceMessageId,
		}: { userId: string; data: NewMyFood; sourceMessageId: string | null },
		tx: Prisma.TransactionClient,
	): Promise<MyFood | null> {
		const { count } = await tx.myFood.createMany({
			data: [{ ...data, userId, sourceMessageId }],
			skipDuplicates: true,
		})
		if (count === 0) return null
		return this.findActiveFoodByName({ userId, nameNormalized: data.nameNormalized }, tx)
	}

	/** Only an active food; false = nothing matched. */
	async updateActiveFood(
		{
			userId,
			id,
			data,
		}: {
			userId: string
			id: string
			data: Prisma.MyFoodUpdateManyMutationInput
		},
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).myFood.updateMany({
			where: { id, userId, deletedAt: null },
			data,
		})
		return count === 1
	}

	/** Soft delete (a date) or restore (null); only a row in the opposite state. */
	async setDeletedAt(
		{ userId, id, deletedAt }: { userId: string; id: string; deletedAt: Date | null },
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).myFood.updateMany({
			where: { id, userId, deletedAt: deletedAt === null ? { not: null } : null },
			data: { deletedAt },
		})
		return count === 1
	}

	/** forget_food asked "remove it?" in this user message; a newer question overwrites the older one. */
	async setRemovalProposed(
		{ userId, ids, messageId }: { userId: string; ids: string[]; messageId: string },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.myFood.updateMany({
			where: { id: { in: ids }, userId, deletedAt: null },
			data: { removalProposedMessageId: messageId },
		})
	}

	/** Active foods the question of that user message (not older than `since`) is about. */
	findRemovalProposed(
		{ userId, messageId, since }: { userId: string; messageId: string; since: Date },
		tx?: Prisma.TransactionClient,
	): Promise<MyFood[]> {
		return (tx ?? this.prisma).myFood.findMany({
			where: {
				userId,
				deletedAt: null,
				removalProposedMessageId: messageId,
				removalProposedMessage: { createdAt: { gte: since } },
			},
			orderBy: { createdAt: 'asc' },
		})
	}

	/**
	 * Soft delete that the question of the previous message (not older than `since`) allows: the
	 * condition and the write are one statement. The proposal stays on the row for the history marker.
	 */
	async deleteProposed(
		{
			userId,
			id,
			messageId,
			since,
			deletedAt,
		}: { userId: string; id: string; messageId: string; since: Date; deletedAt: Date },
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await tx.myFood.updateMany({
			where: {
				id,
				userId,
				deletedAt: null,
				removalProposedMessageId: messageId,
				removalProposedMessage: { createdAt: { gte: since } },
			},
			data: { deletedAt },
		})
		return count === 1
	}

	/** Foods deleted since `since`, the newest first: what "bring it back" can still reach. */
	findDeletedSince({
		userId,
		since,
		limit,
	}: {
		userId: string
		since: Date
		limit: number
	}): Promise<MyFood[]> {
		return this.prisma.myFood.findMany({
			where: { userId, deletedAt: { gte: since } },
			orderBy: { deletedAt: 'desc' },
			take: limit,
		})
	}

	async markUsed(
		{ userId, ids, usedAt }: { userId: string; ids: string[]; usedAt: Date },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.myFood.updateMany({
			where: { id: { in: ids }, userId, deletedAt: null },
			data: { usageCount: { increment: 1 }, lastUsedAt: usedAt },
		})
	}
}
