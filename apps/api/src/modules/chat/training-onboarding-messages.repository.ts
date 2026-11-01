import { Injectable } from '@nestjs/common'
import type { TrainingOnboarding } from '@kus/shared'

import { MessageRole, MessageStatus, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

const HAS_ONBOARDING = {
	role: MessageRole.ASSISTANT,
	trainingOnboarding: { not: Prisma.DbNull },
} satisfies Prisma.MessageWhereInput

const ONBOARDING_FIELDS = {
	id: true,
	trainingOnboarding: true,
	updatedAt: true,
} satisfies Prisma.MessageSelect

export type OnboardingMessageRow = Prisma.MessageGetPayload<{ select: typeof ONBOARDING_FIELDS }>

/** Kusik's training onboarding messages; every query carries the owner's `userId`. */
@Injectable()
export class TrainingOnboardingMessagesRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** The owner's onboarding message; another user's reads the same as none. */
	findById(
		{ userId, id }: { userId: string; id: string },
		tx?: Prisma.TransactionClient,
	): Promise<OnboardingMessageRow | null> {
		return (tx ?? this.prisma).message.findFirst({
			where: { id, userId, ...HAS_ONBOARDING },
			select: ONBOARDING_FIELDS,
		})
	}

	/** The newest onboarding messages before `beforeId` (or overall), newest first. */
	findLatest(
		{ userId, beforeId, take }: { userId: string; beforeId?: string; take: number },
		tx?: Prisma.TransactionClient,
	): Promise<OnboardingMessageRow[]> {
		return (tx ?? this.prisma).message.findMany({
			where: { userId, ...HAS_ONBOARDING, ...(beforeId ? { id: { lt: beforeId } } : {}) },
			// uuid v7 ids grow with time, see message-cursor.ts
			orderBy: { id: 'desc' },
			take,
			select: ONBOARDING_FIELDS,
		})
	}

	/** Whether the invitation was ever offered (a later message of the first session must not repeat it). */
	async hasInvitation(userId: string, tx?: Prisma.TransactionClient): Promise<boolean> {
		const invitation = await (tx ?? this.prisma).message.findFirst({
			where: { userId, ...HAS_ONBOARDING, trainingOnboarding: { path: ['step'], equals: 0 } },
			select: { id: true },
		})
		return invitation !== null
	}

	/** The newest completed user message: anything older than it was passed by. */
	async findNewestCompletedUserMessageId(
		userId: string,
		tx?: Prisma.TransactionClient,
	): Promise<string | null> {
		const newest = await (tx ?? this.prisma).message.findFirst({
			where: { userId, role: MessageRole.USER, status: MessageStatus.COMPLETED },
			orderBy: { id: 'desc' },
			select: { id: true },
		})
		return newest?.id ?? null
	}

	/** A question Kusik asks on his own (start) — no user turn behind it. */
	create(
		{ userId, trainingOnboarding }: { userId: string; trainingOnboarding: TrainingOnboarding },
		tx: Prisma.TransactionClient,
	): Promise<{ id: string }> {
		return tx.message.create({
			data: {
				userId,
				role: MessageRole.ASSISTANT,
				content: null,
				status: MessageStatus.COMPLETED,
				trainingOnboarding,
			},
			select: { id: true },
		})
	}

	/** The invitation onto a reply written in this same turn. */
	async setOnReply(
		{
			userId,
			id,
			trainingOnboarding,
		}: { userId: string; id: string; trainingOnboarding: TrainingOnboarding },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.message.updateMany({ where: { id, userId }, data: { trainingOnboarding } })
	}

	/**
	 * The payload of a message, only while it is as it was read (`updatedAt`): of two answers to one
	 * question only the first one lands. false = it changed meanwhile.
	 */
	async setPayload(
		{
			userId,
			id,
			readAt,
			trainingOnboarding,
		}: { userId: string; id: string; readAt: Date; trainingOnboarding: TrainingOnboarding },
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await tx.message.updateMany({
			where: { id, userId, updatedAt: readAt },
			data: { trainingOnboarding },
		})
		return count === 1
	}
}
