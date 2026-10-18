import { Injectable, Logger } from '@nestjs/common'
import {
	type AiFoodItem,
	type DayCard,
	type DeleteMeasurementInput,
	ENTRY_AHEAD_MAX_DAYS,
	ENTRY_BACKDATE_MAX_DAYS,
	type FoodParseDecision,
	getDayOffset,
	type LogFoodInput,
	type LogMeasurementInput,
} from '@kus/shared'

import { formatDbDate, getLocalHour } from '../../common/time'
import { AttachmentStatus, MeasurementKind, type Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { AchievementsService } from '../achievements/achievements.service'
import { EntriesService } from '../entries/entries.service'
import type { LogEntriesParams, MealEntryInput, NewFoodEntry } from '../entries/entries.types'
import { MemoryService, type RelevantFoods } from '../memory/memory.service'
import { ChatDayCardService } from './chat-day-card.service'
import { ChatEditsService, type EditedMessages, NO_EDITED_MESSAGES } from './chat-edits.service'
import { MessageInProgressException, TurnDateOutOfRangeException } from './chat.exceptions'
import { ChatTurnMeasurementsService } from './chat-turn-measurements.service'
import { ChatRepository, type MessageWithAttachments } from './chat.repository'
import type { PhotoPayload } from '../../common/photo'
import { ClarificationsRepository } from './clarifications.repository'
import type { EditRefIds } from './edit-context'
import { getMealEatenAtForDay, getMealTypeByHour } from '../entries/meal-type'

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

const hasWeight = (measurements: LogMeasurementInput[]): boolean =>
	measurements.some(({ kind }) => kind === MeasurementKind.WEIGHT)

const getReplyText = (decision: FoodParseDecision): string => {
	switch (decision.kind) {
		case 'log':
			return decision.log.reply
		case 'edit':
		case 'day':
			return decision.text
		case 'not_food':
		case 'photo_unusable':
			return decision.reply
		case 'reply':
			return decision.text
	}
}

const getMealKey = (day: string, mealType: string): string => `${day}|${mealType}`

const toDbDate = (date: string): Date => new Date(`${date}T00:00:00Z`)

/** Stores what the model decided for one turn: the reply, the edits, new entries and questions. */
@Injectable()
export class ChatTurnService {
	private readonly logger = new Logger(ChatTurnService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly chatRepository: ChatRepository,
		private readonly clarificationsRepository: ClarificationsRepository,
		private readonly chatEdits: ChatEditsService,
		private readonly entriesService: EntriesService,
		private readonly memoryService: MemoryService,
		private readonly turnMeasurements: ChatTurnMeasurementsService,
		private readonly achievementsService: AchievementsService,
		private readonly dayCards: ChatDayCardService,
	) {}

	async saveDecision(
		{ userId, timezone, message, photo, now, localDate }: TurnParams,
		decision: FoodParseDecision,
		{ memory, refIds }: { memory: RelevantFoods; refIds: EditRefIds },
	): Promise<TurnResult> {
		// the numbers of the card are counted before the turn is written; a card is a snapshot anyway
		const dayCard = await this.buildDayCard({ userId, message, now, localDate }, decision)
		return this.prisma.$transaction(async (tx) => {
			const reply = await this.chatRepository.completeTurn(
				{ userId, userMessageId: message.id, replyText: getReplyText(decision), dayCard },
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
				const replaced = await this.saveMeasurements(
					{ userId, timezone, message, now, localDate },
					decision,
					tx,
				)
				await this.achievementsService.recordForTurn(
					{
						userId,
						timezone,
						now,
						replyMessageId: reply.id,
						userMessageId: message.id,
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
						userMessageId: message.id,
						isFoodChanged: decision.edits.restorations.length > 0,
						isWeightLogged: false,
					},
					tx,
				)
				return { ...edited, replacedMeasurementMessageIds: [] }
			}

			const { entries, getEatenAt } = this.planEntries({
				params: { userId, timezone, message, now, localDate },
				log: decision.log,
				memory,
				isFromPhoto: photo !== undefined,
			})
			const { entryIds } = await this.entriesService.logEntries(
				{ userId, sourceMessageId: message.id, getEatenAt, entries },
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
			const replaced = await this.saveMeasurements(
				{ userId, timezone, message, now, localDate },
				decision,
				tx,
			)
			await this.achievementsService.recordForTurn(
				{
					userId,
					timezone,
					now,
					replyMessageId: reply.id,
					userMessageId: message.id,
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

	/** show_day only; null when the day is empty (the reply stays a text). */
	private async buildDayCard(
		{
			userId,
			message,
			now,
			localDate,
		}: Pick<TurnParams, 'userId' | 'message' | 'now' | 'localDate'>,
		decision: FoodParseDecision,
	): Promise<DayCard | undefined> {
		if (decision.kind !== 'day') return undefined
		const today = formatDbDate(localDate)
		const day = decision.date ?? today
		// the card is read-only, so any past day is fine (not just the logging window); only the
		// upper bound mirrors the parser, and a miss there is a bug that stops the turn
		if (getDayOffset(day, today) > ENTRY_AHEAD_MAX_DAYS) {
			this.logger.error(`Day out of range user=${userId} message=${message.id}`)
			throw new TurnDateOutOfRangeException()
		}
		return (await this.dayCards.build({ userId, localDate: day, today, now })) ?? undefined
	}

	/** Food is logged only in the window; the parser rejects other days, so a miss is a bug and stops the turn. */
	private assertLoggableDay({
		day,
		today,
		userId,
		messageId,
	}: {
		day: string
		today: string
		userId: string
		messageId: string
	}): void {
		const offset = getDayOffset(day, today)
		if (offset >= -ENTRY_BACKDATE_MAX_DAYS && offset <= ENTRY_AHEAD_MAX_DAYS) return
		this.logger.error(`Day out of range user=${userId} message=${messageId}`)
		throw new TurnDateOutOfRangeException()
	}

	/** Deletions first (the parser keeps them apart from new values), then the new values. */
	private async saveMeasurements(
		params: Pick<TurnParams, 'userId' | 'timezone' | 'message' | 'now' | 'localDate'>,
		{
			measurements,
			measurementDeletions,
		}: {
			measurements: LogMeasurementInput[]
			measurementDeletions: DeleteMeasurementInput[]
		},
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		const deleted = await this.turnMeasurements.remove(
			{ ...params, deletions: measurementDeletions },
			tx,
		)
		const replaced = await this.turnMeasurements.record({ ...params, measurements }, tx)
		return [...deleted, ...replaced]
	}

	/**
	 * Each item goes to its own day (item, else the call, else today) and meal (item, else the call,
	 * else the clock of the turn — also for another day). Days outside the loggable window never get
	 * here: the parser rejects them, so a miss is a bug and stops the turn.
	 */
	private planEntries({
		params: { userId, timezone, message, now, localDate },
		log,
		memory,
		isFromPhoto,
	}: {
		params: Pick<TurnParams, 'userId' | 'timezone' | 'message' | 'now' | 'localDate'>
		log: LogFoodInput
		memory: RelevantFoods
		isFromPhoto: boolean
	}): { entries: MealEntryInput[]; getEatenAt: LogEntriesParams['getEatenAt'] } {
		const today = formatDbDate(localDate)
		const clockMealType = getMealTypeByHour(getLocalHour(now, timezone))
		const namedMeals = new Set<string>()
		const entries = log.items.map((item) => {
			const day = item.date ?? log.date ?? today
			this.assertLoggableDay({ day, today, userId, messageId: message.id })
			const namedType = item.mealType ?? log.mealType
			if (namedType) namedMeals.add(getMealKey(day, namedType))
			return {
				mealType: namedType ?? clockMealType,
				localDate: toDbDate(day),
				entry: this.toNewEntry(item, memory, isFromPhoto),
			}
		})
		return {
			entries,
			getEatenAt: ({ type, localDate: mealDate }) =>
				getMealEatenAtForDay({
					mealType: type,
					isNamed: namedMeals.has(getMealKey(formatDbDate(mealDate), type)),
					localDate: mealDate,
					now,
					timezone,
				}),
		}
	}

	/** A memory item takes its numbers from the saved food, scaled by the backend. */
	// mealType, date and memoryRef aren't FoodEntry columns: left in the spread, Prisma would reject them
	private toNewEntry(
		{ memoryRef, mealType: _mealType, date: _date, ...item }: AiFoodItem,
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
