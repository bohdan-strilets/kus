import { Injectable } from '@nestjs/common'
import type { ChatMessage, SendMessageResponse } from '@kus/shared'

import { getLocalDate } from '../../common/time'
import { EntriesService } from '../entries/entries.service'
import { ChatContextService } from './chat-context.service'
import type { EditedMessages } from './chat-edits.service'
import { ChatFeedService } from './chat-feed.service'
import { ChatRepository } from './chat.repository'

interface BuildResponseParams {
	userId: string
	userMessageId: string
	timezone: string
	/** null for a replay: the day of the logged meal, else of the reply. */
	localDate: Date | null
	edited: EditedMessages
}

/** What POST /messages returns: the turn, the day totals and the earlier cards it changed. */
@Injectable()
export class ChatResponseService {
	constructor(
		private readonly chatRepository: ChatRepository,
		private readonly chatContext: ChatContextService,
		private readonly chatFeed: ChatFeedService,
		private readonly entriesService: EntriesService,
	) {}

	async build({
		userId,
		userMessageId,
		timezone,
		localDate,
		edited,
	}: BuildResponseParams): Promise<SendMessageResponse> {
		const [userMessage, reply] = await Promise.all([
			this.chatRepository.findById({ userId, id: userMessageId }),
			this.chatRepository.findReply({ userId, userMessageId }),
		])
		// both were written by this request (or the completed one it replays)
		if (!userMessage || !reply) throw new Error('Completed chat turn is missing a message')

		const [userDto, replyDto] = await this.chatFeed.toChatMessages(userId, [userMessage, reply])
		if (!userDto || !replyDto) throw new Error('Chat turn lost a message while mapping')
		const [firstMeal] = replyDto.meals
		const mealDate = firstMeal ? new Date(`${firstMeal.localDate}T00:00:00Z`) : null
		const dayDate = localDate ?? mealDate ?? getLocalDate(reply.createdAt, timezone)
		const [{ totals }, updatedMessages] = await Promise.all([
			this.chatContext.getDayOverview(userId, dayDate),
			this.findUpdatedMessages(userId, edited, reply.id),
		])
		return { userMessage: userDto, assistantMessage: replyDto, dayTotals: totals, updatedMessages }
	}

	/** The earlier replies whose cards or questions this turn changed, as they are now. */
	private async findUpdatedMessages(
		userId: string,
		{ sourceMessageIds, replyIds }: EditedMessages,
		currentReplyId: string,
	): Promise<ChatMessage[]> {
		if (sourceMessageIds.length === 0 && replyIds.length === 0) return []
		// a question answered in words changed the entries of the message it asked about
		const answered = await this.chatRepository.findAssistantMessages({
			userId,
			ids: replyIds,
			replyToIds: [],
		})
		const changedSources = [
			...sourceMessageIds,
			...answered.flatMap((message) => message.replyToId ?? []),
		]
		// a meal's totals show on the card of every message that logged into it
		const replyToIds = await this.entriesService.getMessagesSharingMeals(userId, changedSources)
		const messages = await this.chatRepository.findAssistantMessages({
			userId,
			ids: replyIds,
			replyToIds,
		})
		const earlier = messages.filter((message) => message.id !== currentReplyId)
		return this.chatFeed.toChatMessages(userId, earlier)
	}
}
