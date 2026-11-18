import type { DayMealContext, FoodEntryResponse, LoggedMeal, NutritionTotals } from '@kus/shared'

import { formatDbDate } from '../../common/time'
import type { FoodEntry } from '../../generated/prisma/client'
import type { EntryWithSavedFood, MealWithEntries } from './entries.repository'

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

/**
 * Entries that are never a food to remember: «Без деталей» (the rest of a day) and a portion of
 * an active saved recipe (the recipe is its food; read without it, it counts as active).
 */
export const isNeverRememberable = (entry: EntryWithSavedFood): boolean => {
	if (entry.isUndetailed) return true
	if (entry.recipeId === null) return false
	return entry.recipe ? entry.recipe.deletedAt === null : true
}

/**
 * «Запам'ятати» is offered for an entry with no saved food, or whose saved food was deleted; a
 * linked entry read without its food (myFood not loaded) stays not rememberable.
 */
export const canRemember = (entry: EntryWithSavedFood): boolean => {
	if (isNeverRememberable(entry)) return false
	if (entry.myFoodId === null) return true
	return (entry.myFood?.deletedAt ?? null) !== null
}

export const toFoodEntryResponse = (entry: EntryWithSavedFood): FoodEntryResponse => ({
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
	copiedFromDate: entry.copiedFromDate === null ? null : formatDbDate(entry.copiedFromDate),
	isUndetailed: entry.isUndetailed,
	canRemember: canRemember(entry),
})

/** Totals of the `entries` the caller shows; the whole meal's kcal only when it holds more. */
const toMeal = (meal: MealWithEntries, entries: EntryWithSavedFood[]): LoggedMeal => ({
	id: meal.id,
	type: meal.type,
	localDate: formatDbDate(meal.localDate),
	eatenAt: meal.eatenAt.toISOString(),
	totals: sumEntries(entries),
	mealTotalKcal: entries.length < meal.entries.length ? sumEntries(meal.entries).kcal : null,
	entries: entries.map(toFoodEntryResponse),
})

/** A chat card: only the entries with the given ids (a message's own entries, or just created ones). */
export const toLoggedMeal = (meal: MealWithEntries, entryIds: ReadonlySet<string>): LoggedMeal =>
	toMeal(
		meal,
		meal.entries.filter((entry) => entryIds.has(entry.id)),
	)

/** A meal on «Сьогодні»: every entry. */
export const toDayMeal = (meal: MealWithEntries): LoggedMeal => toMeal(meal, meal.entries)

export const toDayMealContext = (meal: MealWithEntries): DayMealContext => ({
	type: meal.type,
	kcal: sumEntries(meal.entries).kcal,
})
