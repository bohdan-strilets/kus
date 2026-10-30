import { Injectable } from '@nestjs/common'
import type { FactCategory, FactStatus } from '@kus/shared'

import type { Prisma, UserFact } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

export interface NewFact {
	userId: string
	text: string
	textNormalized: string
	category: FactCategory
	status: FactStatus
	sourceMessageId: string | null
}

@Injectable()
export class FactsRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** Active confirmed facts in the order «Пам'ять» lists them: by category (enum order), then oldest first. */
	findConfirmedByCategory(userId: string, tx?: Prisma.TransactionClient): Promise<UserFact[]> {
		return (tx ?? this.prisma).userFact.findMany({
			where: { userId, status: 'CONFIRMED', deletedAt: null },
			orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
		})
	}

	/** Oldest first: the order the model's `f1…` refs are numbered in. */
	findConfirmedOldestFirst(
		{ userId, limit }: { userId: string; limit: number },
		tx?: Prisma.TransactionClient,
	): Promise<UserFact[]> {
		return (tx ?? this.prisma).userFact.findMany({
			where: { userId, status: 'CONFIRMED', deletedAt: null },
			orderBy: { createdAt: 'asc' },
			take: limit,
		})
	}

	countConfirmed(userId: string, tx?: Prisma.TransactionClient): Promise<number> {
		return (tx ?? this.prisma).userFact.count({
			where: { userId, status: 'CONFIRMED', deletedAt: null },
		})
	}

	/** Active or deleted, any status, but always the user's own. */
	findById(
		{ userId, id }: { userId: string; id: string },
		tx?: Prisma.TransactionClient,
	): Promise<UserFact | null> {
		return (tx ?? this.prisma).userFact.findFirst({ where: { id, userId } })
	}

	/** The fact the partial unique index guards: active and not rejected. */
	findLiveByText(
		{ userId, textNormalized }: { userId: string; textNormalized: string },
		tx?: Prisma.TransactionClient,
	): Promise<UserFact | null> {
		return (tx ?? this.prisma).userFact.findFirst({
			where: { userId, textNormalized, deletedAt: null, status: { not: 'REJECTED' } },
		})
	}

	findOpenProposal(userId: string, tx?: Prisma.TransactionClient): Promise<UserFact | null> {
		return (tx ?? this.prisma).userFact.findFirst({
			where: { userId, status: 'PROPOSED', deletedAt: null },
			orderBy: { createdAt: 'desc' },
		})
	}

	findByMessages(
		{ userId, messageIds }: { userId: string; messageIds: string[] },
		tx?: Prisma.TransactionClient,
	): Promise<UserFact[]> {
		return (tx ?? this.prisma).userFact.findMany({
			where: { userId, sourceMessageId: { in: messageIds }, deletedAt: null },
			orderBy: { createdAt: 'asc' },
		})
	}

	/**
	 * Conflict-safe insert: ON CONFLICT DO NOTHING honours the partial unique index, and a violation
	 * inside a transaction would abort it. null = a live fact of this text exists already.
	 */
	async create(data: NewFact, tx?: Prisma.TransactionClient): Promise<UserFact | null> {
		const client = tx ?? this.prisma
		const { count } = await client.userFact.createMany({ data: [data], skipDuplicates: true })
		if (count === 0) return null
		return this.findLiveByText({ userId: data.userId, textNormalized: data.textNormalized }, tx)
	}

	/** Only an active confirmed fact; false = nothing matched. */
	async updateText(
		{
			userId,
			id,
			text,
			textNormalized,
		}: { userId: string; id: string; text: string; textNormalized: string },
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).userFact.updateMany({
			where: { id, userId, status: 'CONFIRMED', deletedAt: null },
			data: { text, textNormalized },
		})
		return count === 1
	}

	/** Moves an active fact from one status to another; false = it wasn't in `from`. */
	async changeStatus(
		{ userId, id, from, to }: { userId: string; id: string; from: FactStatus; to: FactStatus },
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).userFact.updateMany({
			where: { id, userId, status: from, deletedAt: null },
			data: { status: to },
		})
		return count === 1
	}

	/** A new proposal replaces the open one: the old one reads «Не запам'ятовую.» in the chat. */
	async rejectOpenProposals(userId: string, tx?: Prisma.TransactionClient): Promise<number> {
		const { count } = await (tx ?? this.prisma).userFact.updateMany({
			where: { userId, status: 'PROPOSED', deletedAt: null },
			data: { status: 'REJECTED' },
		})
		return count
	}

	/** Soft delete (a date) or restore (null) of a confirmed fact, only a row in the opposite state. */
	async setDeletedAt(
		{ userId, id, deletedAt }: { userId: string; id: string; deletedAt: Date | null },
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).userFact.updateMany({
			where: {
				id,
				userId,
				status: 'CONFIRMED',
				deletedAt: deletedAt === null ? { not: null } : null,
			},
			data: { deletedAt },
		})
		return count === 1
	}

	/** Deleted before `deletedBefore`, or an unanswered / rejected proposal untouched since `staleBefore`. */
	async deleteExpired({
		deletedBefore,
		staleBefore,
	}: {
		deletedBefore: Date
		staleBefore: Date
	}): Promise<number> {
		const { count } = await this.prisma.userFact.deleteMany({
			where: {
				OR: [
					{ deletedAt: { lt: deletedBefore } },
					{ status: { in: ['PROPOSED', 'REJECTED'] }, updatedAt: { lt: staleBefore } },
				],
			},
		})
		return count
	}
}
