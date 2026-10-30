import { Injectable } from '@nestjs/common'
import type { ChatMessage, SendMessageResponse } from '@kus/shared'

import { getLocalDate } from '../../common/time'
import { EntriesService } from '../entries/entries.service'
import { ChatContextService } from './chat-context.service'
import type { EditedMessages } from './chat-edits.service'
import { ChatFeedService } from './chat-feed.service'
import { ChatRepository } from './chat.repository'
import type { SavedFoodRef } from './chat-turn-memory.service'

interface BuildResponseParams {
	userId: string
	userMessageId: string
	timezone: string
	/** The day of the turn (its header totals); null for a replay: the day the message was sent. */
	localDate: Date | null
	edited: EditedMessages & {
		/** User messages whose weight or waist this turn replaced: their replies lose the card. */
		replacedMeasurementMessageIds?: string[]
		/** Foods this turn saved to memory: only the live response tells (a replay or a reload has none). */
		savedFoods?: SavedFoodRef[]
	}
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
		// never the day of a meal: a log for yesterday or tomorrow still leaves today in the header
		const dayDate = localDate ?? getLocalDate(userMessage.createdAt, timezone)
		const [{ totals }, updatedMessages] = await Promise.all([
			this.chatContext.getDayOverview(userId, dayDate),
			this.findUpdatedMessages(userId, edited, reply.id),
		])
		return {
			userMessage: userDto,
			assistantMessage: { ...replyDto, savedFoods: edited.savedFoods ?? [] },
			dayTotals: totals,
			updatedMessages,
		}
	}

	/** The earlier replies whose cards or questions this turn changed, as they are now. */
	private async findUpdatedMessages(
		userId: string,
		{
			sourceMessageIds,
			replyIds,
			replacedMeasurementMessageIds = [],
		}: BuildResponseParams['edited'],
		currentReplyId: string,
	): Promise<ChatMessage[]> {
		if (
			sourceMessageIds.length === 0 &&
			replyIds.length === 0 &&
			replacedMeasurementMessageIds.length === 0
		) {
			return []
		}
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
		// every card of a meal tells the whole meal's kcal («Вечеря разом»)
		const sharingMeals = await this.entriesService.getMessagesSharingMeals(userId, changedSources)
		// a replaced weight has no meal, so the meals lookup would never find its message
		const messages = await this.chatRepository.findAssistantMessages({
			userId,
			ids: replyIds,
			replyToIds: [...new Set([...sharingMeals, ...replacedMeasurementMessageIds])],
		})
		const earlier = messages.filter((message) => message.id !== currentReplyId)
		return this.chatFeed.toChatMessages(userId, earlier)
	}
}
