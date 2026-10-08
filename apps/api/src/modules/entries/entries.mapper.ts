import type { DayMealContext, FoodEntryResponse, LoggedMeal, NutritionTotals } from '@kus/shared'

import { formatDbDate } from '../../common/time'
import type { FoodEntry } from '../../generated/prisma/client'
import type { MealWithEntries } from './entries.repository'

const DECIMALS = 10

/** Stored values and totals keep one decimal: enough for grams and kcal, no float noise. */
export const roundNutrition = (value: number): number => Math.round(value * DECIMALS) / DECIMALS

const EMPTY_TOTALS: NutritionTotals = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }

/** The backend sums, never the model (CLAUDE.md §5). */
export const sumEntries = (entries: FoodEntry[]): NutritionTotals => {
	const sum = entries.reduce<NutritionTotals>(
		(total, entry) => ({
			kcal: total.kcal + entry.kcal,
			protein: total.protein + entry.proteinG,
			fat: total.fat + entry.fatG,
			carbs: total.carbs + entry.carbsG,
			fiber: total.fiber + (entry.fiberG ?? 0),
		}),
		EMPTY_TOTALS,
	)
	return {
		kcal: roundNutrition(sum.kcal),
		protein: roundNutrition(sum.protein),
		fat: roundNutrition(sum.fat),
		carbs: roundNutrition(sum.carbs),
		fiber: roundNutrition(sum.fiber),
	}
}

export const toFoodEntryResponse = (entry: FoodEntry): FoodEntryResponse => ({
	id: entry.id,
	name: entry.name,
	grams: entry.grams,
	quantity: entry.quantity,
	kcal: entry.kcal,
	protein: entry.proteinG,
	fat: entry.fatG,
	carbs: entry.carbsG,
	fiber: entry.fiberG,
	category: entry.category,
	source: entry.source,
	confidence: entry.confidence,
	assumption: entry.assumption,
	isEdited: entry.isEdited,
})

/** Totals always of the whole meal; `entries` — the ones the caller shows. */
const toMeal = (meal: MealWithEntries, entries: FoodEntry[]): LoggedMeal => ({
	id: meal.id,
	type: meal.type,
	localDate: formatDbDate(meal.localDate),
	eatenAt: meal.eatenAt.toISOString(),
	totals: sumEntries(meal.entries),
	entries: entries.map(toFoodEntryResponse),
})

/** A chat card: only the entries that came from `sourceMessageId`. */
export const toLoggedMeal = (meal: MealWithEntries, sourceMessageId: string): LoggedMeal =>
	toMeal(
		meal,
		meal.entries.filter((entry) => entry.sourceMessageId === sourceMessageId),
	)

/** A meal on «Сьогодні»: every entry. */
export const toDayMeal = (meal: MealWithEntries): LoggedMeal => toMeal(meal, meal.entries)

export const toDayMealContext = (meal: MealWithEntries): DayMealContext => ({
	type: meal.type,
	kcal: sumEntries(meal.entries).kcal,
})
