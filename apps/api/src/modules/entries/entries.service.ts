import { Injectable } from '@nestjs/common'
import {
	type ClarifyOption,
	type DayMealContext,
	distributeOptionValues,
	type EntryValues,
	type LoggedMeal,
	type NutritionTotals,
} from '@kus/shared'

import type { FoodEntry, Prisma } from '../../generated/prisma/client'
import {
	roundNutrition,
	sumEntries,
	toDayMeal,
	toDayMealContext,
	toLoggedMeal,
} from './entries.mapper'
import { EntriesRepository, type MealWithEntries } from './entries.repository'
import { getMealRank, MEAL_TYPE_ORDER } from './entries.constants'
import type { LogEntriesParams, NewFoodEntry } from './entries.types'

const roundEntry = (entry: NewFoodEntry): NewFoodEntry => ({
	...entry,
	grams: roundNutrition(entry.grams),
	kcal: roundNutrition(entry.kcal),
	protein: roundNutrition(entry.protein),
	fat: roundNutrition(entry.fat),
	carbs: roundNutrition(entry.carbs),
	fiber: entry.fiber === null ? null : roundNutrition(entry.fiber),
})

const toEntryValues = (entry: FoodEntry): EntryValues => ({
	grams: entry.grams,
	kcal: entry.kcal,
	protein: entry.proteinG,
	fat: entry.fatG,
	carbs: entry.carbsG,
	fiber: entry.fiberG,
})

const ENTRY_VALUE_KEYS = ['grams', 'kcal', 'protein', 'fat', 'carbs', 'fiber'] as const

/** Only the fields that changed, as a Correction stores them; null if nothing did. */
const getChangedValues = (
	before: EntryValues,
	after: EntryValues,
): { before: Record<string, number | null>; after: Record<string, number | null> } | null => {
	const keys = ENTRY_VALUE_KEYS.filter((key) => before[key] !== after[key])
	if (keys.length === 0) return null
	return {
		before: Object.fromEntries(keys.map((key) => [key, before[key]])),
		after: Object.fromEntries(keys.map((key) => [key, after[key]])),
	}
}

export interface DaySummary {
	totals: NutritionTotals
	meals: DayMealContext[]
}

@Injectable()
export class EntriesService {
	constructor(private readonly entriesRepository: EntriesRepository) {}

	/**
	 * Adds each entry to the day's meal of its type (created on first use). Runs inside the
	 * caller's tx. `entryIds` follow the input order, so clarify item indexes still map.
	 */
	async logEntries(
		{ userId, sourceMessageId, getEatenAt, localDate, entries }: LogEntriesParams,
		tx: Prisma.TransactionClient,
	): Promise<{ meals: LoggedMeal[]; entryIds: string[] }> {
		const entryIds: string[] = []
		const meals: LoggedMeal[] = []
		for (const mealType of MEAL_TYPE_ORDER) {
			const group = entries.flatMap((input, index) =>
				input.mealType === mealType ? [{ index, entry: input.entry }] : [],
			)
			if (group.length === 0) continue
			const meal = await this.entriesRepository.findOrCreateMeal(
				{ userId, type: mealType, localDate, eatenAt: getEatenAt(mealType), sourceMessageId },
				tx,
			)
			const created = await this.entriesRepository.createEntries(
				{
					userId,
					mealId: meal.id,
					sourceMessageId,
					entries: group.map(({ entry }) => roundEntry(entry)),
				},
				tx,
			)
			group.forEach(({ index }, position) => {
				const id = created[position]?.id
				// clarify links rely on this order; a mismatch must fail, not leave a hole
				if (!id) throw new Error('Created entries do not match the input')
				entryIds[index] = id
			})
			const withEntries = await this.entriesRepository.findMealWithEntries(
				{ userId, mealId: meal.id },
				tx,
			)
			// the meal was found or created a moment ago in this same transaction
			if (!withEntries) throw new Error('Meal disappeared inside its own transaction')
			meals.push(toLoggedMeal(withEntries, sourceMessageId))
		}
		return { meals, entryIds }
	}

	async getDaySummary(userId: string, localDate: Date): Promise<DaySummary> {
		const meals = await this.findDayMealsInOrder(userId, localDate)
		return {
			totals: sumEntries(meals.flatMap((meal) => meal.entries)),
			meals: meals.map(toDayMealContext),
		}
	}

	/** «Сьогодні»: the day's meals with all their entries and the day totals. */
	async getDayMeals(
		userId: string,
		localDate: Date,
	): Promise<{ meals: LoggedMeal[]; totals: NutritionTotals }> {
		const meals = await this.findDayMealsInOrder(userId, localDate)
		return {
			meals: meals.map(toDayMeal),
			totals: sumEntries(meals.flatMap((meal) => meal.entries)),
		}
	}

	/** Non-empty meals by the day's course: a whole day logged at once shares one eatenAt. */
	private async findDayMealsInOrder(userId: string, localDate: Date): Promise<MealWithEntries[]> {
		const meals = await this.entriesRepository.findDayMeals({ userId, localDate })
		return meals
			.filter((meal) => meal.entries.length > 0)
			.sort((a, b) => getMealRank(a.type) - getMealRank(b.type))
	}

	/**
	 * Re-logs entries with the values of a tapped clarify answer, keeping a Correction (changed
	 * fields only) per entry. `false` = nothing to apply: the entries are gone or would break limits.
	 */
	async applyOptionValues(
		{ userId, entryIds, option }: { userId: string; entryIds: string[]; option: ClarifyOption },
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const entries = await this.entriesRepository.findActiveEntries({ userId, ids: entryIds }, tx)
		// the answer's totals cover every entry it asked about: one deleted, the rest can't take it all
		if (entries.length !== entryIds.length) return false
		const current = entries.map(toEntryValues)
		const updated = distributeOptionValues(current, option)
		if (!updated) return false

		const corrections = []
		for (const [index, entry] of entries.entries()) {
			const before = current[index]
			const after = updated[index]
			if (!before || !after) continue
			const changed = getChangedValues(before, after)
			if (!changed) continue
			await this.entriesRepository.updateValues({ userId, id: entry.id, values: after }, tx)
			corrections.push({ userId, foodEntryId: entry.id, ...changed })
		}
		await this.entriesRepository.createCorrections(corrections, tx)
		return true
	}

	/** Chat cards: for each source message, the meals it logged into, in the day's order. */
	async getLoggedMealsByMessage(
		userId: string,
		messageIds: string[],
	): Promise<Map<string, LoggedMeal[]>> {
		const result = new Map<string, LoggedMeal[]>()
		if (messageIds.length === 0) return result
		const meals = await this.entriesRepository.findMealsBySourceMessages({ userId, messageIds })
		const ordered = [...meals].sort((a, b) => getMealRank(a.type) - getMealRank(b.type))
		for (const meal of ordered) {
			const sources = new Set(meal.entries.map((entry) => entry.sourceMessageId))
			for (const messageId of messageIds) {
				if (!sources.has(messageId)) continue
				result.set(messageId, [...(result.get(messageId) ?? []), toLoggedMeal(meal, messageId)])
			}
		}
		return result
	}
}
