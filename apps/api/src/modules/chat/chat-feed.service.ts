import { Injectable } from '@nestjs/common'
import {
	type AchievementResponse,
	type ChatMessage,
	type ClarificationResponse,
	clarifyOptionViewSchema,
	type ListMessagesQuery,
	type LoggedMeal,
	type MeasurementCard,
} from '@kus/shared'
import { z } from 'zod'

import { CursorPaginatedResult } from '../../common/pagination'
import { MessageRole } from '../../generated/prisma/client'
import { AchievementsService } from '../achievements/achievements.service'
import { EntriesService } from '../entries/entries.service'
import { ChatMeasurementCardsService } from './chat-measurement-cards.service'
import { InvalidCursorException } from './chat.exceptions'
import {
	type ClarificationWithEntries,
	ClarificationsRepository,
} from './clarifications.repository'
import { ChatRepository, type MessageWithAttachments } from './chat.repository'
import { decodeMessageCursor, encodeMessageCursor } from './message-cursor'

// only what the chat shows, so rows stored before options carried macros still read
const storedOptionsSchema = z.array(clarifyOptionViewSchema)

const toClarificationResponse = (
	clarification: ClarificationWithEntries,
): ClarificationResponse => ({
	id: clarification.id,
	question: clarification.question,
	// written by the backend from validated tool input; an unreadable value is shown without chips
	options: storedOptionsSchema.catch([]).parse(clarification.options),
	impactKcal: clarification.impactKcal,
	status: clarification.status,
	answeredOptionIndex: clarification.answerOptionIndex,
	answer: clarification.answer,
	entryIds: clarification.entries.map((entry) => entry.foodEntryId),
})

interface ChatMessageExtras {
	meals: Map<string, LoggedMeal[]>
	clarifications: ClarificationWithEntries[]
	/** By the user message that recorded them. */
	measurements: Map<string, MeasurementCard[]>
	/** By the assistant reply that announced them. */
	achievements: Map<string, AchievementResponse[]>
}

const toChatMessage = (
	message: MessageWithAttachments,
	{ meals, clarifications, measurements, achievements }: ChatMessageExtras,
): ChatMessage => {
	const isAssistant = message.role === MessageRole.ASSISTANT
	const [attachment] = message.attachments
	return {
		id: message.id,
		role: message.role,
		content: message.content,
		status: message.status,
		clientMessageId: message.clientMessageId,
		replyToId: message.replyToId,
		createdAt: message.createdAt.toISOString(),
		photo: attachment ? { status: attachment.status } : null,
		meals: isAssistant && message.replyToId ? (meals.get(message.replyToId) ?? []) : [],
		clarifications: isAssistant
			? clarifications
					.filter((clarification) => clarification.messageId === message.id)
					.map(toClarificationResponse)
			: [],
		measurements:
			isAssistant && message.replyToId ? (measurements.get(message.replyToId) ?? []) : [],
		achievements: isAssistant ? (achievements.get(message.id) ?? []) : [],
	}
}

/** Messages as the chat shows them: assistant replies carry their meal card and questions. */
@Injectable()
export class ChatFeedService {
	constructor(
		private readonly chatRepository: ChatRepository,
		private readonly clarificationsRepository: ClarificationsRepository,
		private readonly entriesService: EntriesService,
		private readonly measurementCards: ChatMeasurementCardsService,
		private readonly achievementsService: AchievementsService,
	) {}

	async toChatMessages(userId: string, messages: MessageWithAttachments[]): Promise<ChatMessage[]> {
		const replies = messages.filter((message) => message.role === MessageRole.ASSISTANT)
		const sourceIds = replies.flatMap((message) => (message.replyToId ? [message.replyToId] : []))
		const [meals, clarifications, measurements, achievements] = await Promise.all([
			this.entriesService.getLoggedMealsByMessage(userId, sourceIds),
			replies.length > 0
				? this.clarificationsRepository.findClarifications({
						userId,
						messageIds: replies.map((message) => message.id),
					})
				: Promise.resolve([]),
			this.measurementCards.getCardsByMessage(userId, sourceIds),
			this.achievementsService.findByMessages(
				userId,
				replies.map((message) => message.id),
			),
		])
		return messages.map((message) =>
			toChatMessage(message, { meals, clarifications, measurements, achievements }),
		)
	}

	/** Newest first; `nextCursor` points at the next, older page. */
	async listMessages(
		userId: string,
		{ cursor, limit }: ListMessagesQuery,
	): Promise<CursorPaginatedResult<ChatMessage>> {
		const position = cursor === undefined ? null : decodeMessageCursor(cursor)
		if (cursor !== undefined && position === null) throw new InvalidCursorException()

		// one extra row tells whether an older page exists
		const rows = await this.chatRepository.findPage({ userId, cursor: position, take: limit + 1 })
		const page = rows.slice(0, limit)
		const last = page.at(-1)
		const nextCursor = rows.length > limit && last ? encodeMessageCursor(last) : null
		return new CursorPaginatedResult(await this.toChatMessages(userId, page), {
			limit,
			nextCursor,
		})
	}
}
