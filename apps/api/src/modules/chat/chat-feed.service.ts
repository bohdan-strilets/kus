import { Injectable } from '@nestjs/common'
import {
	type ChatMessage,
	type ClarificationResponse,
	clarifyOptionViewSchema,
	type ListMessagesQuery,
	type LoggedMeal,
} from '@kus/shared'
import { z } from 'zod'

import { CursorPaginatedResult } from '../../common/pagination'
import { type Message, MessageRole } from '../../generated/prisma/client'
import { EntriesService } from '../entries/entries.service'
import { InvalidCursorException } from './chat.exceptions'
import { type ClarificationWithEntries, ChatRepository } from './chat.repository'
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
	entryIds: clarification.entries.map((entry) => entry.foodEntryId),
})

interface ChatMessageExtras {
	meals: Map<string, LoggedMeal[]>
	clarifications: ClarificationWithEntries[]
}

const toChatMessage = (
	message: Message,
	{ meals, clarifications }: ChatMessageExtras,
): ChatMessage => {
	const isAssistant = message.role === MessageRole.ASSISTANT
	return {
		id: message.id,
		role: message.role,
		content: message.content,
		status: message.status,
		clientMessageId: message.clientMessageId,
		replyToId: message.replyToId,
		createdAt: message.createdAt.toISOString(),
		meals: isAssistant && message.replyToId ? (meals.get(message.replyToId) ?? []) : [],
		clarifications: isAssistant
			? clarifications
					.filter((clarification) => clarification.messageId === message.id)
					.map(toClarificationResponse)
			: [],
	}
}

/** Messages as the chat shows them: assistant replies carry their meal card and questions. */
@Injectable()
export class ChatFeedService {
	constructor(
		private readonly chatRepository: ChatRepository,
		private readonly entriesService: EntriesService,
	) {}

	async toChatMessages(userId: string, messages: Message[]): Promise<ChatMessage[]> {
		const replies = messages.filter((message) => message.role === MessageRole.ASSISTANT)
		const sourceIds = replies.flatMap((message) => (message.replyToId ? [message.replyToId] : []))
		const [meals, clarifications] = await Promise.all([
			this.entriesService.getLoggedMealsByMessage(userId, sourceIds),
			replies.length > 0
				? this.chatRepository.findClarifications({
						userId,
						messageIds: replies.map((message) => message.id),
					})
				: Promise.resolve([]),
		])
		return messages.map((message) => toChatMessage(message, { meals, clarifications }))
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
