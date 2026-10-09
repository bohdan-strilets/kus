import { Injectable } from '@nestjs/common'
import type { AiFoodItem, FoodParseDecision } from '@kus/shared'

import { getLocalHour } from '../../common/time'
import type { Message } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { EntriesService } from '../entries/entries.service'
import type { NewFoodEntry } from '../entries/entries.types'
import { MemoryService, type RelevantFoods } from '../memory/memory.service'
import { ChatEditsService, type EditedMessages, NO_EDITED_MESSAGES } from './chat-edits.service'
import { MessageInProgressException } from './chat.exceptions'
import { ChatRepository } from './chat.repository'
import { ClarificationsRepository } from './clarifications.repository'
import type { EditRefIds } from './edit-context'
import { getMealEatenAt, getMealTypeByHour } from '../entries/meal-type'

export interface TurnParams {
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

/** Stores what the model decided for one turn: the reply, the edits, new entries and questions. */
@Injectable()
export class ChatTurnService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly chatRepository: ChatRepository,
		private readonly clarificationsRepository: ClarificationsRepository,
		private readonly chatEdits: ChatEditsService,
		private readonly entriesService: EntriesService,
		private readonly memoryService: MemoryService,
	) {}

	saveDecision(
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
				await this.clarificationsRepository.createClarification(
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
			// the meals it joined grew: earlier cards of them get a new «разом» line
			return { ...edited, sourceMessageIds: [...edited.sourceMessageIds, message.id] }
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
}
