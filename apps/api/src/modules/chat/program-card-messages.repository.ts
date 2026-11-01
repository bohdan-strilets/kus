import { Injectable } from '@nestjs/common'
import type { ProgramCard } from '@kus/shared'

import { MessageRole, MessageStatus, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

const HAS_PROGRAM_CARD = { programCard: { not: Prisma.DbNull } } satisfies Prisma.MessageWhereInput

/** Kusik's messages that carry a program card; every query carries the owner's `userId`. */
@Injectable()
export class ProgramCardMessagesRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** The owner's assistant message with a card; another user's reads the same as none. */
	findCardMessage(
		{ userId, id }: { userId: string; id: string },
		tx?: Prisma.TransactionClient,
	): Promise<{ id: string; programCard: Prisma.JsonValue } | null> {
		return (tx ?? this.prisma).message.findFirst({
			where: { id, userId, role: MessageRole.ASSISTANT, ...HAS_PROGRAM_CARD },
			select: { id: true, programCard: true },
		})
	}

	/** The newest card of the user (the partial index `messages_program_card_idx`). */
	async findNewestCardMessageId(
		userId: string,
		tx?: Prisma.TransactionClient,
	): Promise<string | null> {
		const newest = await (tx ?? this.prisma).message.findFirst({
			where: { userId, ...HAS_PROGRAM_CARD },
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			select: { id: true },
		})
		return newest?.id ?? null
	}

	/** Serializes the user's card writers until the transaction ends (a transaction-scoped advisory lock). */
	async lockCards(userId: string, tx: Prisma.TransactionClient): Promise<void> {
		const key = `program-cards:${userId}`
		// executeRaw: the lock function returns void, which a query result cannot hold
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`
	}

	/** Kusik's own message (no user turn behind it) with a recounted card, or only the text. */
	create(
		{
			userId,
			content,
			programCard,
		}: { userId: string; content: string; programCard?: ProgramCard },
		tx: Prisma.TransactionClient,
	): Promise<{ id: string }> {
		return tx.message.create({
			data: {
				userId,
				role: MessageRole.ASSISTANT,
				content,
				status: MessageStatus.COMPLETED,
				...(programCard ? { programCard } : {}),
			},
			select: { id: true },
		})
	}
}
