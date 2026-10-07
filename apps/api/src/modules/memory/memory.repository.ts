import { Injectable } from '@nestjs/common'

import type { MyFood, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

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
