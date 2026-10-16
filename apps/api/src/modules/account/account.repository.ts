import { Injectable } from '@nestjs/common'

import type { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

export interface DeletionState {
	purgeAt: Date | null
}

/** The deletion lifecycle of a user row; the rest of the user lives in UsersRepository. */
@Injectable()
export class AccountRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** null when the user is gone (purged between the token check and this read). */
	findDeletionState(userId: string, tx?: Prisma.TransactionClient): Promise<DeletionState | null> {
		return (tx ?? this.prisma).user.findUnique({ where: { id: userId }, select: { purgeAt: true } })
	}

	async requestDeletion(
		{ userId, requestedAt, purgeAt }: { userId: string; requestedAt: Date; purgeAt: Date },
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		await (tx ?? this.prisma).user.updateMany({
			where: { id: userId },
			data: { deletionRequestedAt: requestedAt, purgeAt },
		})
	}

	/** true when the account was pending; false = nothing to restore (already active, or gone). */
	async restore(userId: string, tx?: Prisma.TransactionClient): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).user.updateMany({
			where: { id: userId, purgeAt: { not: null } },
			data: { deletionRequestedAt: null, purgeAt: null },
		})
		return count === 1
	}

	/** One page of users past their grace, ordered by id; `afterId` is the keyset cursor. */
	async findExpiredUserIds(
		{ now, limit, afterId }: { now: Date; limit: number; afterId?: string },
		tx?: Prisma.TransactionClient,
	): Promise<string[]> {
		const users = await (tx ?? this.prisma).user.findMany({
			where: { purgeAt: { lte: now }, ...(afterId ? { id: { gt: afterId } } : {}) },
			select: { id: true },
			orderBy: { id: 'asc' },
			take: limit,
		})
		return users.map((user) => user.id)
	}

	/**
	 * Hard delete of one user; every table cascades (schema.prisma, onDelete: Cascade).
	 * The purgeAt filter keeps a user who restored the account meanwhile.
	 */
	async deleteExpiredUser(
		{ userId, now }: { userId: string; now: Date },
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).user.deleteMany({
			where: { id: userId, purgeAt: { lte: now } },
		})
		return count === 1
	}
}
