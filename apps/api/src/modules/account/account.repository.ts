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

	async restore(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
		await (tx ?? this.prisma).user.updateMany({
			where: { id: userId },
			data: { deletionRequestedAt: null, purgeAt: null },
		})
	}

	/** Hard delete; every table of the user cascades (schema.prisma, onDelete: Cascade). */
	async deleteExpired(now: Date, tx?: Prisma.TransactionClient): Promise<number> {
		const { count } = await (tx ?? this.prisma).user.deleteMany({
			where: { purgeAt: { lte: now } },
		})
		return count
	}
}
