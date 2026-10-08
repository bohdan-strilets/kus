import { Injectable } from '@nestjs/common'
import type { ClarifyOption } from '@kus/shared'

import { type Clarification, ClarificationStatus, type Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

export type ClarificationWithEntries = Clarification & { entries: { foodEntryId: string }[] }

interface CreateClarificationData {
	userId: string
	messageId: string
	question: string
	options: ClarifyOption[]
	impactKcal: number
	entryIds: string[]
}

/** Clarify questions of the chat: stored with their options, answered by a tap or in words. */
@Injectable()
export class ClarificationsRepository {
	constructor(private readonly prisma: PrismaService) {}

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
