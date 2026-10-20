import { Injectable } from '@nestjs/common'
import { DAY_CARD_VERSION, type DayCard, type DayCardKind, getDayVerdict } from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import { EntriesService } from '../entries/entries.service'
import { GoalsService } from '../goals/goals.service'

interface BuildDayCardParams {
	userId: string
	/** `YYYY-MM-DD` of the shown day. */
	localDate: string
	/** `YYYY-MM-DD` of the user's today. */
	today: string
	now: Date
	/** The card closes the day (close_day), not just shows it. */
	isClosing?: boolean
	/** The turn's transaction, when the day was changed in it and the card must see that. */
	tx?: Prisma.TransactionClient
}

// `YYYY-MM-DD` strings sort like the days they name
const getKind = (localDate: string, today: string): DayCardKind => {
	if (localDate === today) return 'today'
	return localDate < today ? 'past' : 'planned'
}

/** The snapshot behind the day card of show_day and close_day: every number counted here, none taken from the model. */
@Injectable()
export class ChatDayCardService {
	constructor(
		private readonly entriesService: EntriesService,
		private readonly goalsService: GoalsService,
	) {}

	/** null for a day without entries: there is nothing to show, the reply stays text. */
	async build({
		userId,
		localDate,
		today,
		now,
		isClosing = false,
		tx,
	}: BuildDayCardParams): Promise<DayCard | null> {
		const dbDate = new Date(`${localDate}T00:00:00Z`)
		const [{ meals, totals }, goal] = await Promise.all([
			tx
				? this.entriesService.getDayMeals(userId, dbDate, tx)
				: this.entriesService.getDayMeals(userId, dbDate),
			this.goalsService.getGoalForDate(userId, dbDate),
		])
		if (meals.length === 0) return null

		const kind = getKind(localDate, today)
		const entryCount = meals.reduce((count, meal) => count + meal.entries.length, 0)
		return {
			version: DAY_CARD_VERSION,
			localDate,
			kind,
			asOf: kind === 'today' ? now.toISOString() : null,
			totals: { kcal: totals.kcal, protein: totals.protein, fat: totals.fat, carbs: totals.carbs },
			goal: goal
				? { kcal: goal.kcal, protein: goal.protein, fat: goal.fat, carbs: goal.carbs }
				: null,
			remainingKcal: goal ? Math.round(goal.kcal - totals.kcal) : null,
			meals: meals.map(({ type, eatenAt, totals: mealTotals }) => ({
				type,
				eatenAt,
				kcal: mealTotals.kcal,
			})),
			// a planned day has nothing to be judged against yet
			...(kind === 'planned'
				? {}
				: {
						verdict: getDayVerdict({ kcal: totals.kcal, entryCount, goalKcal: goal?.kcal ?? null }),
					}),
			...(isClosing ? { isClosing } : {}),
		}
	}
}
