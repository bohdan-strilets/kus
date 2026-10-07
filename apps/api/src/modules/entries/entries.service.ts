import { Injectable } from '@nestjs/common'
import type { DayMealContext, LoggedMeal, NutritionTotals } from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import { roundNutrition, sumEntries, toDayMealContext, toLoggedMeal } from './entries.mapper'
import { EntriesRepository } from './entries.repository'
import type { LogEntriesParams } from './entries.types'

export interface DaySummary {
	totals: NutritionTotals
	meals: DayMealContext[]
}

@Injectable()
export class EntriesService {
	constructor(private readonly entriesRepository: EntriesRepository) {}

	/** Adds entries to the day's meal of that type (created on first use). Runs inside the caller's tx. */
	async logEntries(
		{ userId, sourceMessageId, mealType, eatenAt, localDate, entries }: LogEntriesParams,
		tx: Prisma.TransactionClient,
	): Promise<{ meal: LoggedMeal; entryIds: string[] }> {
		const meal = await this.entriesRepository.findOrCreateMeal(
			{ userId, type: mealType, localDate, eatenAt, sourceMessageId },
			tx,
		)
		const created = await this.entriesRepository.createEntries(
			{
				userId,
				mealId: meal.id,
				sourceMessageId,
				entries: entries.map((entry) => ({
					...entry,
					grams: roundNutrition(entry.grams),
					kcal: roundNutrition(entry.kcal),
					protein: roundNutrition(entry.protein),
					fat: roundNutrition(entry.fat),
					carbs: roundNutrition(entry.carbs),
					fiber: entry.fiber === null ? null : roundNutrition(entry.fiber),
				})),
			},
			tx,
		)
		const withEntries = await this.entriesRepository.findMealWithEntries(
			{ userId, mealId: meal.id },
			tx,
		)
		// the meal was found or created a moment ago in this same transaction
		if (!withEntries) throw new Error('Meal disappeared inside its own transaction')
		return {
			meal: toLoggedMeal(withEntries, sourceMessageId),
			entryIds: created.map((entry) => entry.id),
		}
	}

	async getDaySummary(userId: string, localDate: Date): Promise<DaySummary> {
		const meals = await this.entriesRepository.findDayMeals({ userId, localDate })
		return {
			totals: sumEntries(meals.flatMap((meal) => meal.entries)),
			meals: meals.filter((meal) => meal.entries.length > 0).map(toDayMealContext),
		}
	}

	/** Chat cards: for each source message, the meal it logged into. */
	async getLoggedMealsByMessage(
		userId: string,
		messageIds: string[],
	): Promise<Map<string, LoggedMeal>> {
		const result = new Map<string, LoggedMeal>()
		if (messageIds.length === 0) return result
		const meals = await this.entriesRepository.findMealsBySourceMessages({ userId, messageIds })
		for (const meal of meals) {
			const sources = new Set(meal.entries.map((entry) => entry.sourceMessageId))
			for (const messageId of messageIds) {
				if (sources.has(messageId)) result.set(messageId, toLoggedMeal(meal, messageId))
			}
		}
		return result
	}
}
