import { Injectable, Logger } from '@nestjs/common'
import type {
	AiFoodItem,
	ChatMessage,
	FoodParseDecision,
	SendMessageRequest,
	SendMessageResponse,
} from '@kus/shared'

import { getLocalDate, getLocalHour } from '../../common/time'
import { type Message, MessageStatus, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { AiUsageService } from '../ai/ai-usage.service'
import { AiService } from '../ai/ai.service'
import { EntriesService } from '../entries/entries.service'
import type { NewFoodEntry } from '../entries/entries.types'
import { MemoryService, type RelevantFoods } from '../memory/memory.service'
import { UsersService } from '../users/users.service'
import { ChatContextService } from './chat-context.service'
import { ChatEditsService, type EditedMessages, NO_EDITED_MESSAGES } from './chat-edits.service'
import { ChatFeedService } from './chat-feed.service'
import { STALE_PENDING_MS } from './chat.constants'
import { ClientMessageIdReusedException, MessageInProgressException } from './chat.exceptions'
import { ChatRepository } from './chat.repository'
import type { EditRefIds } from './edit-context'
import { getMealEatenAt, getMealTypeByHour } from './meal-type'

const UNIQUE_VIOLATION = 'P2002'

const isUniqueViolation = (error: unknown): boolean =>
	error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION

interface TurnParams {
	userId: string
	timezone: string
	message: Message
	text: string
	now: Date
	localDate: Date
}

const getReplyText = (decision: FoodParseDecision): string => {
	switch (decision.kind) {
		case 'log':
			return decision.log.reply
		case 'edit':
			return decision.text
		case 'not_food':
			return decision.reply
		case 'reply':
			return decision.text
	}
}

/** One chat turn: user message → AI → entries / questions / answer, idempotent by clientMessageId. */
@Injectable()
export class ChatService {
	private readonly logger = new Logger(ChatService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly chatRepository: ChatRepository,
		private readonly chatContext: ChatContextService,
		private readonly chatFeed: ChatFeedService,
		private readonly chatEdits: ChatEditsService,
		private readonly aiService: AiService,
		private readonly aiUsage: AiUsageService,
		private readonly entriesService: EntriesService,
		private readonly memoryService: MemoryService,
		private readonly usersService: UsersService,
	) {}

	async sendMessage(
		userId: string,
		{ clientMessageId, text }: SendMessageRequest,
	): Promise<SendMessageResponse> {
		const { timezone } = await this.usersService.getMe(userId)
		const message = await this.acquireMessage({ userId, clientMessageId, text })
		const now = new Date()
		const localDate = getLocalDate(now, timezone)

		if (message.status === MessageStatus.COMPLETED) {
			return this.buildResponse({
				userId,
				userMessageId: message.id,
				timezone,
				localDate: null,
				edited: NO_EDITED_MESSAGES,
			})
		}
		const edited = await this.processTurn({ userId, timezone, message, text, now, localDate })
		// the day the entries went to, even if the resend happened after midnight
		return this.buildResponse({ userId, userMessageId: message.id, timezone, localDate, edited })
	}

	/**
	 * New message → PENDING row. A resend returns the stored one if it's done, takes a FAILED or
	 * lost one for another try, and refuses while the first request is still running.
	 */
	private async acquireMessage(params: {
		userId: string
		clientMessageId: string
		text: string
	}): Promise<Message> {
		const existing = await this.chatRepository.findByClientMessageId(params)
		if (!existing) {
			return this.chatRepository
				.createUserMessage({
					userId: params.userId,
					clientMessageId: params.clientMessageId,
					content: params.text,
				})
				.catch((error: unknown) => {
					// a parallel request with the same clientMessageId created it after our check
					if (isUniqueViolation(error)) throw new MessageInProgressException()
					throw error
				})
		}
		if (existing.content !== params.text) throw new ClientMessageIdReusedException()
		if (existing.status === MessageStatus.COMPLETED) return existing

		const isClaimed = await this.chatRepository.claimForRetry({
			id: existing.id,
			userId: params.userId,
			staleBefore: new Date(Date.now() - STALE_PENDING_MS),
		})
		if (!isClaimed) throw new MessageInProgressException()
		return { ...existing, status: MessageStatus.PENDING }
	}

	private async processTurn(params: TurnParams): Promise<EditedMessages> {
		const { userId, message } = params
		try {
			await this.aiUsage.reserveMessage(userId, params.localDate)
			const memory = await this.memoryService.findRelevantFoods(userId, params.text)
			const { context, refIds } = await this.chatContext.buildContext({
				...params,
				memory: memory.context,
			})
			const decision = await this.aiService.parseFood({
				userId,
				messageId: message.id,
				localDate: params.localDate,
				context,
				text: params.text,
			})
			const edited = await this.saveDecision(params, decision, { memory, refIds })
			this.logger.log(`Chat turn ${decision.kind} user=${userId} message=${message.id}`)
			return edited
		} catch (error) {
			// the client shows "Не надіслано" and resends the same clientMessageId
			await this.chatRepository
				.markFailed({ id: message.id, userId })
				.catch((markError: unknown) => {
					// keep the original error for the client; the message stays PENDING until it goes stale
					this.logger.error(`Could not mark message FAILED message=${message.id}`, markError)
				})
			throw error
		}
	}

	private async saveDecision(
		{ userId, timezone, message, now, localDate }: TurnParams,
		decision: FoodParseDecision,
		{ memory, refIds }: { memory: RelevantFoods; refIds: EditRefIds },
	): Promise<EditedMessages> {
		return this.prisma.$transaction(async (tx) => {
			const reply = await this.chatRepository.completeTurn(
				{ userId, userMessageId: message.id, replyText: getReplyText(decision) },
				tx,
			)
			// a resend of a stale turn finished it meanwhile; roll back instead of logging food twice
			if (!reply) throw new MessageInProgressException()
			if (decision.kind !== 'log' && decision.kind !== 'edit') return NO_EDITED_MESSAGES
			// earlier entries first: their refs describe the day before this message
			const edited = await this.chatEdits.applyEdits(
				{ userId, userMessageId: message.id, edits: decision.edits, refIds },
				tx,
			)
			if (decision.kind === 'edit') return edited

			// an item's own meal, else the message's, else the clock
			const fallbackMealType =
				decision.log.mealType ?? getMealTypeByHour(getLocalHour(now, timezone))
			const namedMealTypes = new Set(
				decision.log.items.flatMap((item) => item.mealType ?? decision.log.mealType ?? []),
			)
			const entries = decision.log.items.map((item) => ({
				mealType: item.mealType ?? fallbackMealType,
				entry: this.toNewEntry(item, memory),
			}))
			const { entryIds } = await this.entriesService.logEntries(
				{
					userId,
					sourceMessageId: message.id,
					getEatenAt: (mealType) =>
						getMealEatenAt({ mealType, isNamed: namedMealTypes.has(mealType), now, timezone }),
					localDate,
					entries,
				},
				tx,
			)
			const usedFoodIds = [...new Set(entries.flatMap(({ entry }) => entry.myFoodId ?? []))]
			await this.memoryService.markUsed({ userId, ids: usedFoodIds, usedAt: now }, tx)

			for (const clarification of decision.clarifications) {
				await this.chatRepository.createClarification(
					{
						userId,
						messageId: reply.id,
						question: clarification.question,
						options: clarification.options,
						impactKcal: clarification.impactKcal,
						entryIds: clarification.itemIndexes.flatMap((index) => entryIds[index] ?? []),
					},
					tx,
				)
			}
			return edited
		})
	}

	/** A memory item takes its numbers from the saved food, scaled by the backend. */
	// mealType and memoryRef aren't FoodEntry columns: left in the spread, Prisma would reject them
	private toNewEntry(
		{ memoryRef, mealType: _mealType, ...item }: AiFoodItem,
		memory: RelevantFoods,
	): NewFoodEntry {
		const food = memoryRef === null ? undefined : memory.byRef.get(memoryRef)
		if (!food) return { ...item, myFoodId: null }
		return {
			...item,
			...this.memoryService.getPortionValues(food, item.grams),
			source: 'MEMORY',
			myFoodId: food.id,
		}
	}

	private async buildResponse({
		userId,
		userMessageId,
		timezone,
		localDate,
		edited,
	}: {
		userId: string
		userMessageId: string
		timezone: string
		/** null for a replay: the day of the logged meal, else of the reply. */
		localDate: Date | null
		edited: EditedMessages
	}): Promise<SendMessageResponse> {
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
