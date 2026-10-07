import { Injectable } from '@nestjs/common'
import type { ClarifyOption } from '@kus/shared'

import {
	type Clarification,
	type Message,
	MessageRole,
	MessageStatus,
	type Prisma,
} from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import type { MessageCursor } from './message-cursor'

export type ClarificationWithEntries = Clarification & { entries: { foodEntryId: string }[] }

interface CreateClarificationData {
	userId: string
	messageId: string
	question: string
	options: ClarifyOption[]
	impactKcal: number
	entryIds: string[]
}

@Injectable()
export class ChatRepository {
	constructor(private readonly prisma: PrismaService) {}

	findByClientMessageId({
		userId,
		clientMessageId,
	}: {
		userId: string
		clientMessageId: string
	}): Promise<Message | null> {
		// full unique (userId, clientMessageId), so findUnique is exact
		return this.prisma.message.findUnique({
			where: { userId_clientMessageId: { userId, clientMessageId } },
		})
	}

	createUserMessage(data: {
		userId: string
		clientMessageId: string
		content: string
	}): Promise<Message> {
		return this.prisma.message.create({
			data: { ...data, role: MessageRole.USER, status: MessageStatus.PENDING },
		})
	}

	/**
	 * Takes a FAILED (or lost PENDING) message back to PENDING for one more try. Conditional,
	 * so of two parallel resends only one gets `true`.
	 */
	async claimForRetry({
		id,
		userId,
		staleBefore,
	}: {
		id: string
		userId: string
		staleBefore: Date
	}): Promise<boolean> {
		const { count } = await this.prisma.message.updateMany({
			where: {
				id,
				userId,
				OR: [
					{ status: MessageStatus.FAILED },
					{ status: MessageStatus.PENDING, updatedAt: { lt: staleBefore } },
				],
			},
			data: { status: MessageStatus.PENDING },
		})
		return count === 1
	}

	/** Only a PENDING message: a turn that another request already completed stays COMPLETED. */
	async markFailed({ id, userId }: { id: string; userId: string }): Promise<void> {
		await this.prisma.message.updateMany({
			where: { id, userId, status: MessageStatus.PENDING },
			data: { status: MessageStatus.FAILED },
		})
	}

	/**
	 * Completes the user's message and stores the assistant reply to it. Conditional on PENDING:
	 * `null` = another request (a retry of a stale turn) already finished it — the caller rolls back.
	 */
	async completeTurn(
		{
			userId,
			userMessageId,
			replyText,
		}: { userId: string; userMessageId: string; replyText: string },
		tx: Prisma.TransactionClient,
	): Promise<Message | null> {
		const { count } = await tx.message.updateMany({
			where: { id: userMessageId, userId, status: MessageStatus.PENDING },
			data: { status: MessageStatus.COMPLETED },
		})
		if (count !== 1) return null
		return tx.message.create({
			data: {
				userId,
				role: MessageRole.ASSISTANT,
				content: replyText,
				status: MessageStatus.COMPLETED,
				replyToId: userMessageId,
			},
		})
	}

	async createClarification(
		{ entryIds, options, ...data }: CreateClarificationData,
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.clarification.create({
			data: {
				...data,
				options: options.map(({ label, kcal }) => ({ label, kcal })),
				entries: { create: entryIds.map((foodEntryId) => ({ foodEntryId })) },
			},
		})
	}

	findById({ userId, id }: { userId: string; id: string }): Promise<Message | null> {
		return this.prisma.message.findFirst({ where: { id, userId } })
	}

	findReply({
		userId,
		userMessageId,
	}: {
		userId: string
		userMessageId: string
	}): Promise<Message | null> {
		return this.prisma.message.findFirst({
			where: { userId, replyToId: userMessageId, role: MessageRole.ASSISTANT },
			orderBy: { createdAt: 'desc' },
		})
	}

	/** Completed turns before a message, newest first — the model's short memory of the chat. */
	findHistory({
		userId,
		beforeId,
		limit,
	}: {
		userId: string
		beforeId: string
		limit: number
	}): Promise<Message[]> {
		return this.prisma.message.findMany({
			where: {
				userId,
				status: MessageStatus.COMPLETED,
				content: { not: null },
				id: { lt: beforeId },
			},
			// uuid v7 ids grow with time, see message-cursor.ts
			orderBy: { id: 'desc' },
			take: limit,
		})
	}

	findPage({
		userId,
		cursor,
		take,
	}: {
		userId: string
		cursor: MessageCursor | null
		take: number
	}): Promise<Message[]> {
		return this.prisma.message.findMany({
			where: { userId, ...(cursor ? { id: { lt: cursor.id } } : {}) },
			// uuid v7 ids grow with time, see message-cursor.ts
			orderBy: { id: 'desc' },
			take,
		})
	}

	findClarifications({
		userId,
		messageIds,
	}: {
		userId: string
		messageIds: string[]
	}): Promise<ClarificationWithEntries[]> {
		return this.prisma.clarification.findMany({
			where: { userId, messageId: { in: messageIds } },
			include: { entries: { select: { foodEntryId: true } } },
			orderBy: { createdAt: 'asc' },
		})
	}
}
