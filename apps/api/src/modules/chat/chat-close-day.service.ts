import { Injectable, Logger } from '@nestjs/common'
import {
	type DayCard,
	ENTRY_BACKDATE_MAX_DAYS,
	getDayOffset,
	getUndetailedEntryValues,
	UNDETAILED_ENTRY_CATEGORY,
	UNDETAILED_ENTRY_CONFIDENCE,
	UNDETAILED_ENTRY_NAME,
} from '@kus/shared'

import { formatDbDate } from '../../common/time'
import { MealType, type Prisma } from '../../generated/prisma/client'
import { EntriesService } from '../entries/entries.service'
import type { NewFoodEntry } from '../entries/entries.types'
import { getMealEatenAtForDay } from '../entries/meal-type'
import { ChatDayCardService } from './chat-day-card.service'
import { TurnDateOutOfRangeException } from './chat.exceptions'

interface CloseDayParams {
	userId: string
	messageId: string
	/** `YYYY-MM-DD`; null = today. */
	date: string | null
	estimatedTotalKcal: number | null
	/** The user's today, a @db.Date value. */
	localDate: Date
	timezone: string
	now: Date
}

export interface ClosedDay {
	/** null for a day with nothing in it: the reply stays a text. */
	dayCard: DayCard | null
	/** An entry «Без деталей» was added, so earlier cards of its meal grew. */
	isLogged: boolean
}

/** close_day: the day's card with its verdict, after filling the gap up to the user's own total. */
@Injectable()
export class ChatCloseDayService {
	private readonly logger = new Logger(ChatCloseDayService.name)

	constructor(
		private readonly entriesService: EntriesService,
		private readonly dayCards: ChatDayCardService,
	) {}

	/** Runs inside the turn's transaction: the entry and the card belong to the same snapshot. */
	async close(params: CloseDayParams, tx: Prisma.TransactionClient): Promise<ClosedDay> {
		const { userId, messageId, date, localDate, now } = params
		const today = formatDbDate(localDate)
		const day = date ?? today
		const offset = getDayOffset(day, today)
		// the parser rejects these days, so a miss here is a bug and stops the turn
		if (offset > 0 || offset < -ENTRY_BACKDATE_MAX_DAYS) {
			this.logger.error(`Day out of range user=${userId} message=${messageId}`)
			throw new TurnDateOutOfRangeException()
		}
		const isLogged = await this.logGap({ ...params, day }, tx)
		const dayCard = await this.dayCards.build({
			userId,
			localDate: day,
			today,
			now,
			isClosing: true,
			tx,
		})
		return { dayCard, isLogged }
	}

	/**
	 * One estimate entry for what the user's total has over the day so far; never a subtraction.
	 * The gap has no time of day, so it is always a snack, whatever the clock says.
	 */
	private async logGap(
		{ userId, messageId, day, estimatedTotalKcal, timezone, now }: CloseDayParams & { day: string },
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		if (estimatedTotalKcal === null) return false
		const dayDate = new Date(`${day}T00:00:00Z`)
		const { totals } = await this.entriesService.getDayMeals(userId, dayDate, tx)
		const gapKcal = Math.round(estimatedTotalKcal - totals.kcal)
		if (gapKcal <= 0) return false

		const entry: NewFoodEntry = {
			name: UNDETAILED_ENTRY_NAME,
			...getUndetailedEntryValues(gapKcal),
			quantity: null,
			fiber: null,
			category: UNDETAILED_ENTRY_CATEGORY,
			source: 'ESTIMATE',
			confidence: UNDETAILED_ENTRY_CONFIDENCE,
			assumption: null,
			myFoodId: null,
			fromPhoto: false,
			isUndetailed: true,
		}
		await this.entriesService.logEntries(
			{
				userId,
				sourceMessageId: messageId,
				getEatenAt: ({ type, localDate }) =>
					getMealEatenAtForDay({ mealType: type, isNamed: false, localDate, now, timezone }),
				entries: [{ mealType: MealType.SNACK, localDate: dayDate, entry }],
			},
			tx,
		)
		return true
	}
}
