import { Injectable } from '@nestjs/common'
import type { AiFoodItem, FoodParseDecision, LogMeasurementInput } from '@kus/shared'

import { formatDbDate, getLocalHour, getZonedMoment } from '../../common/time'
import {
	AttachmentStatus,
	MeasurementKind,
	MeasurementSource,
	type Prisma,
} from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { AchievementsService } from '../achievements/achievements.service'
import { EntriesService } from '../entries/entries.service'
import type { NewFoodEntry } from '../entries/entries.types'
import { MeasurementsService } from '../measurements/measurements.service'
import { MemoryService, type RelevantFoods } from '../memory/memory.service'
import { ChatEditsService, type EditedMessages, NO_EDITED_MESSAGES } from './chat-edits.service'
import { MessageInProgressException } from './chat.exceptions'
import { ChatRepository, type MessageWithAttachments } from './chat.repository'
import type { PhotoPayload } from './photo'
import { ClarificationsRepository } from './clarifications.repository'
import type { EditRefIds } from './edit-context'
import { getMealEatenAt, getMealTypeByHour } from '../entries/meal-type'

export interface TurnParams {
	userId: string
	timezone: string
	message: MessageWithAttachments
	text?: string
	photo?: PhotoPayload
	now: Date
	localDate: Date
}

/** What an edited turn changed, and the messages whose measurement card a new value replaced. */
export interface TurnResult extends EditedMessages {
	replacedMeasurementMessageIds: string[]
}

const MEASUREMENT_BACKDATE_HOUR = 12

const hasWeight = (measurements: LogMeasurementInput[]): boolean =>
	measurements.some(({ kind }) => kind === MeasurementKind.WEIGHT)

const getReplyText = (decision: FoodParseDecision): string => {
	switch (decision.kind) {
		case 'log':
			return decision.log.reply
		case 'edit':
			return decision.text
		case 'not_food':
		case 'photo_unusable':
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
		private readonly measurementsService: MeasurementsService,
		private readonly achievementsService: AchievementsService,
	) {}

	saveDecision(
		{ userId, timezone, message, photo, now, localDate }: TurnParams,
		decision: FoodParseDecision,
		{ memory, refIds }: { memory: RelevantFoods; refIds: EditRefIds },
	): Promise<TurnResult> {
		return this.prisma.$transaction(async (tx) => {
			const reply = await this.chatRepository.completeTurn(
				{ userId, userMessageId: message.id, replyText: getReplyText(decision) },
				tx,
			)
			// a resend of a stale turn finished it meanwhile; roll back instead of logging food twice
			if (!reply) throw new MessageInProgressException()
			if (photo) {
				await this.chatRepository.setAttachmentStatus(
					{
						userId,
						messageId: message.id,
						status:
							decision.kind === 'photo_unusable'
								? AttachmentStatus.FAILED
								: AttachmentStatus.PROCESSED,
					},
					tx,
				)
			}
			if (decision.kind === 'reply') {
				const replaced = await this.recordMeasurements(
					{ userId, timezone, message, now, localDate, measurements: decision.measurements },
					tx,
				)
				await this.achievementsService.recordForTurn(
					{
						userId,
						timezone,
						now,
						replyMessageId: reply.id,
						isFoodChanged: false,
						isWeightLogged: hasWeight(decision.measurements),
					},
					tx,
				)
				return { ...NO_EDITED_MESSAGES, replacedMeasurementMessageIds: replaced }
			}
			if (decision.kind !== 'log' && decision.kind !== 'edit') {
				return { ...NO_EDITED_MESSAGES, replacedMeasurementMessageIds: [] }
			}
			// earlier entries first: their refs describe the day before this message
			const edited = await this.chatEdits.applyEdits(
				{ userId, userMessageId: message.id, edits: decision.edits, refIds },
				tx,
			)
			if (decision.kind === 'edit') {
				// a restored entry can complete a streak; corrections and deletions never do
				await this.achievementsService.recordForTurn(
					{
						userId,
						timezone,
						now,
						replyMessageId: reply.id,
						isFoodChanged: decision.edits.restorations.length > 0,
						isWeightLogged: false,
					},
					tx,
				)
				return { ...edited, replacedMeasurementMessageIds: [] }
			}

			// an item's own meal, else the message's, else the clock
			const fallbackMealType =
				decision.log.mealType ?? getMealTypeByHour(getLocalHour(now, timezone))
			const namedMealTypes = new Set(
				decision.log.items.flatMap((item) => item.mealType ?? decision.log.mealType ?? []),
			)
			const entries = decision.log.items.map((item) => ({
				mealType: item.mealType ?? fallbackMealType,
				entry: this.toNewEntry(item, memory, photo !== undefined),
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
			const replaced = await this.recordMeasurements(
				{ userId, timezone, message, now, localDate, measurements: decision.measurements },
				tx,
			)
			await this.achievementsService.recordForTurn(
				{
					userId,
					timezone,
					now,
					replyMessageId: reply.id,
					isFoodChanged: true,
					isWeightLogged: hasWeight(decision.measurements),
				},
				tx,
			)
			// the meals it joined grew: earlier cards of them get a new «разом» line
			return {
				...edited,
				sourceMessageIds: [...edited.sourceMessageIds, message.id],
				replacedMeasurementMessageIds: replaced,
			}
		})
	}

	/**
	 * Weight and waist of the message, one per day and kind: a second value of a day replaces the
	 * first. Returns the messages that carried the replaced values.
	 */
	private async recordMeasurements(
		{
			userId,
			timezone,
			message,
			now,
			localDate,
			measurements,
		}: Pick<TurnParams, 'userId' | 'timezone' | 'message' | 'now' | 'localDate'> & {
			measurements: LogMeasurementInput[]
		},
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		const replacedMessageIds: string[] = []
		for (const { kind, value, date } of measurements) {
			const day = date === null ? localDate : new Date(`${date}T00:00:00Z`)
			const isToday = formatDbDate(day) === formatDbDate(localDate)
			const previous = await this.measurementsService.findByDate(
				{ userId, kind, localDate: day },
				tx,
			)
			await this.measurementsService.record(
				{
					userId,
					kind,
					value,
					localDate: day,
					// a past day has no real time of day: noon keeps it on that date in any timezone
					measuredAt: isToday ? now : getZonedMoment(day, MEASUREMENT_BACKDATE_HOUR, timezone),
					source: MeasurementSource.CHAT,
					messageId: message.id,
				},
				tx,
			)
			if (previous?.messageId && previous.messageId !== message.id) {
				replacedMessageIds.push(previous.messageId)
			}
		}
		return replacedMessageIds
	}

	/** A memory item takes its numbers from the saved food, scaled by the backend. */
	// mealType and memoryRef aren't FoodEntry columns: left in the spread, Prisma would reject them
	private toNewEntry(
		{ memoryRef, mealType: _mealType, ...item }: AiFoodItem,
		memory: RelevantFoods,
		fromPhoto: boolean,
	): NewFoodEntry {
		const food = memoryRef === null ? undefined : memory.byRef.get(memoryRef)
		if (!food) return { ...item, myFoodId: null, fromPhoto }
		return {
			...item,
			fromPhoto,
			...this.memoryService.getPortionValues(food, item.grams),
			source: 'MEMORY',
			myFoodId: food.id,
		}
	}
}
