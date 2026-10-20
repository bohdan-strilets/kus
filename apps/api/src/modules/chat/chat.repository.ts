import { Injectable } from '@nestjs/common'
import type { DayCard, StatsCard } from '@kus/shared'

import {
	AttachmentStatus,
	type Message,
	MessageRole,
	MessageStatus,
	type Prisma,
} from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import type { MessageCursor } from './message-cursor'
import type { PhotoPayload } from '../../common/photo'

/** What the chat shows of a photo, in grid order; the bytes are in object storage, not here. */
const WITH_ATTACHMENTS = {
	attachments: {
		select: { status: true, fileId: true, width: true, height: true, position: true },
		orderBy: { position: 'asc' },
	},
} as const

export type MessageWithAttachments = Prisma.MessageGetPayload<{ include: typeof WITH_ATTACHMENTS }>

/** The stored copy a message binds: the attachment repeats its type and size. */
export interface StoredPhotoRef {
	id: string
	mimeType: string
	width: number
	height: number
	sizeBytes: number
}

const toAttachmentData = (photo: PhotoPayload) => ({
	mimeType: photo.mimeType,
	width: photo.width,
	height: photo.height,
	sizeBytes: photo.sizeBytes,
	status: AttachmentStatus.PENDING,
})

const toStoredAttachmentData = (
	{ id, mimeType, width, height, sizeBytes }: StoredPhotoRef,
	position: number,
) => ({
	fileId: id,
	position,
	mimeType,
	width,
	height,
	sizeBytes,
	status: AttachmentStatus.PENDING,
})

@Injectable()
export class ChatRepository {
	constructor(private readonly prisma: PrismaService) {}

	findByClientMessageId({
		userId,
		clientMessageId,
	}: {
		userId: string
		clientMessageId: string
	}): Promise<MessageWithAttachments | null> {
		// full unique (userId, clientMessageId), so findUnique is exact
		return this.prisma.message.findUnique({
			where: { userId_clientMessageId: { userId, clientMessageId } },
			include: WITH_ATTACHMENTS,
		})
	}

	/**
	 * An inline photo's bytes are not stored: only type, size and status go to the attachment. Stored
	 * photos are bound by `fileId` in the same write (a nested create is one transaction), so the
	 * unique index on file_id decides who gets a file: P2002 = taken, P2003 = the file is gone.
	 */
	createUserMessage({
		photo,
		storedPhotos,
		...data
	}: {
		userId: string
		clientMessageId: string
		content: string | null
		photo?: PhotoPayload
		storedPhotos?: StoredPhotoRef[]
	}): Promise<MessageWithAttachments> {
		const attachments = storedPhotos
			? storedPhotos.map(toStoredAttachmentData)
			: photo
				? [toAttachmentData(photo)]
				: []
		return this.prisma.message.create({
			data: {
				...data,
				role: MessageRole.USER,
				status: MessageStatus.PENDING,
				...(attachments.length > 0 ? { attachments: { create: attachments } } : {}),
			},
			include: WITH_ATTACHMENTS,
		})
	}

	/**
	 * A retry starts the attachments over. An inline photo travels again (it is not stored), so its
	 * description is rewritten; a stored one keeps its file and only goes back to PENDING.
	 */
	async resetAttachment({
		userId,
		messageId,
		photo,
	}: {
		userId: string
		messageId: string
		photo?: PhotoPayload
	}): Promise<void> {
		await this.prisma.messageAttachment.updateMany({
			where: { messageId, message: { userId } },
			data: photo ? toAttachmentData(photo) : { status: AttachmentStatus.PENDING },
		})
	}

	async setAttachmentStatus(
		{ userId, messageId, status }: { userId: string; messageId: string; status: AttachmentStatus },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.messageAttachment.updateMany({
			where: { messageId, message: { userId } },
			data: { status },
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
			dayCard,
			statsCard,
		}: {
			userId: string
			userMessageId: string
			replyText: string
			dayCard?: DayCard
			statsCard?: StatsCard
		},
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
				...(dayCard ? { dayCard } : {}),
				...(statsCard ? { statsCard } : {}),
			},
		})
	}

	/** The card of a reply written in this same turn, once the day it shows has been changed. */
	async setDayCard(
		{ userId, id, dayCard }: { userId: string; id: string; dayCard: DayCard },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.message.updateMany({ where: { id, userId }, data: { dayCard } })
	}

	/** Kusik's own message, not a reply to a user turn (the greeting after account-restore). */
	createAssistantMessage(
		{ userId, content }: { userId: string; content: string },
		tx?: Prisma.TransactionClient,
	): Promise<Message> {
		return (tx ?? this.prisma).message.create({
			data: { userId, role: MessageRole.ASSISTANT, content, status: MessageStatus.COMPLETED },
		})
	}

	findById({ userId, id }: { userId: string; id: string }): Promise<MessageWithAttachments | null> {
		return this.prisma.message.findFirst({ where: { id, userId }, include: WITH_ATTACHMENTS })
	}

	findReply({
		userId,
		userMessageId,
	}: {
		userId: string
		userMessageId: string
	}): Promise<MessageWithAttachments | null> {
		return this.prisma.message.findFirst({
			where: { userId, replyToId: userMessageId, role: MessageRole.ASSISTANT },
			orderBy: { createdAt: 'desc' },
			include: WITH_ATTACHMENTS,
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
	}): Promise<MessageWithAttachments[]> {
		return this.prisma.message.findMany({
			where: {
				userId,
				status: MessageStatus.COMPLETED,
				// a photo-only message has no text but still happened
				OR: [{ content: { not: null } }, { attachments: { some: {} } }],
				id: { lt: beforeId },
			},
			// uuid v7 ids grow with time, see message-cursor.ts
			orderBy: { id: 'desc' },
			take: limit,
			include: WITH_ATTACHMENTS,
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
	}): Promise<MessageWithAttachments[]> {
		return this.prisma.message.findMany({
			where: { userId, ...(cursor ? { id: { lt: cursor.id } } : {}) },
			// uuid v7 ids grow with time, see message-cursor.ts
			orderBy: { id: 'desc' },
			take,
			include: WITH_ATTACHMENTS,
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
	}): Promise<MessageWithAttachments[]> {
		return this.prisma.message.findMany({
			where: {
				userId,
				role: MessageRole.ASSISTANT,
				OR: [{ id: { in: ids } }, { replyToId: { in: replyToIds } }],
			},
			orderBy: { id: 'asc' },
			include: WITH_ATTACHMENTS,
		})
	}
}
