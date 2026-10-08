import { Injectable } from '@nestjs/common'
import type { ClarifyOption } from '@kus/shared'

import {
	type Clarification,
	ClarificationStatus,
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
				options: options.map(({ label, kcal, protein, fat, carbs, fiber, grams, name }) => ({
					label,
					kcal,
					protein,
					fat,
					carbs,
					fiber,
					grams,
					name,
				})),
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

	findClarification(
		{ userId, id }: { userId: string; id: string },
		tx: Prisma.TransactionClient,
	): Promise<ClarificationWithEntries | null> {
		return tx.clarification.findFirst({
			where: { id, userId },
			include: { entries: { select: { foodEntryId: true } } },
		})
	}

	/**
	 * Conditional on OPEN: `false` = a parallel answer (a tap or the chat) came first, the caller
	 * rolls back. `optionIndex` null = answered in words; `answerMessageId` — the user's message then.
	 */
	async markClarificationAnswered(
		{
			userId,
			id,
			optionIndex,
			answer,
			answerMessageId,
		}: {
			userId: string
			id: string
			optionIndex: number | null
			answer: string
			answerMessageId: string | null
		},
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await tx.clarification.updateMany({
			where: { id, userId, status: ClarificationStatus.OPEN },
			data: {
				status: ClarificationStatus.ANSWERED,
				answerOptionIndex: optionIndex,
				answer,
				answerMessageId,
				answeredAt: new Date(),
			},
		})
		return count === 1
	}

	/**
	 * Open questions about entries the user changed in words: a later tap would spread the old
	 * option over the corrected entry. Returns the replies that asked them.
	 */
	async dismissOpenClarifications(
		{ userId, entryIds }: { userId: string; entryIds: string[] },
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		if (entryIds.length === 0) return []
		const where = {
			userId,
			status: ClarificationStatus.OPEN,
			entries: { some: { foodEntryId: { in: entryIds } } },
		}
		const open = await tx.clarification.findMany({ where, select: { messageId: true } })
		await tx.clarification.updateMany({ where, data: { status: ClarificationStatus.DISMISSED } })
		return open.map((clarification) => clarification.messageId)
	}

	/** Open questions about these entries, newest first. */
	findOpenClarifications({
		userId,
		entryIds,
		take,
	}: {
		userId: string
		entryIds: string[]
		take: number
	}): Promise<ClarificationWithEntries[]> {
		return this.prisma.clarification.findMany({
			where: {
				userId,
				status: ClarificationStatus.OPEN,
				entries: { some: { foodEntryId: { in: entryIds } } },
			},
			include: { entries: { select: { foodEntryId: true } } },
			orderBy: { createdAt: 'desc' },
			take,
		})
	}

	/** Assistant messages by id or by the user message they answer — the cards an edit changed. */
	findAssistantMessages({
		userId,
		ids,
		replyToIds,
	}: {
		userId: string
		ids: string[]
		replyToIds: string[]
	}): Promise<Message[]> {
		return this.prisma.message.findMany({
			where: {
				userId,
				role: MessageRole.ASSISTANT,
				OR: [{ id: { in: ids } }, { replyToId: { in: replyToIds } }],
			},
			orderBy: { id: 'asc' },
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
