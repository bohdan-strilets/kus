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

	createFood(
		{ userId, data }: { userId: string; data: NewMyFood },
		tx: Prisma.TransactionClient,
	): Promise<MyFood> {
		return tx.myFood.create({ data: { ...data, userId } })
	}

	/** Only an active food; false = nothing matched. */
	async updateActiveFood({
		userId,
		id,
		data,
	}: {
		userId: string
		id: string
		data: Prisma.MyFoodUpdateManyMutationInput
	}): Promise<boolean> {
		const { count } = await this.prisma.myFood.updateMany({
			where: { id, userId, deletedAt: null },
			data,
		})
		return count === 1
	}

	/** Soft delete (a date) or restore (null); only a row in the opposite state. */
	async setDeletedAt({
		userId,
		id,
		deletedAt,
	}: {
		userId: string
		id: string
		deletedAt: Date | null
	}): Promise<boolean> {
		const { count } = await this.prisma.myFood.updateMany({
			where: { id, userId, deletedAt: deletedAt === null ? { not: null } : null },
			data: { deletedAt },
		})
		return count === 1
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
