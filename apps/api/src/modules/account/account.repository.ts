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

	/** Hard delete; every table of the user cascades (schema.prisma, onDelete: Cascade). */
	async deleteExpired(now: Date, tx?: Prisma.TransactionClient): Promise<number> {
		const { count } = await (tx ?? this.prisma).user.deleteMany({
			where: { purgeAt: { lte: now } },
		})
		return count
	}
}
