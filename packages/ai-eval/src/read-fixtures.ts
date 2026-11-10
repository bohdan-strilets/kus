// What the user's data looks like to the read tools of a case: the saved foods and the earlier
// entries of the case, in the shape the backend hands to runFindFood. The backend reads them from
// the database; the eval reads them from the case.
import {
	type FindFoodData,
	type FindFoodHistoryEntry,
	type FindFoodSavedFood,
	FIND_FOOD_HISTORY_DAYS,
	findMentionedFoods,
	getDayOffset,
	MEMORY_PASSIVE_MAX_FOODS,
	MEMORY_PASSIVE_MIN_SCORE,
	type MemoryFoodContext,
	SAVED_FOOD_REF_PREFIX,
} from '@kus/shared'

import { getCaseToday } from './cases/case-builders.js'
import { type EvalCase, type SavedFood, savedFoodSchema } from './cases/case.types.js'

/** A fixture needs no database id: a saved food is known by its place in the case's list. */
const toSavedKey = (index: number): string => `saved:${index}`
const toHistoryKey = (index: number): string => `history:${index}`

/** A saved food of a case in code: the defaults the DB would fill in. */
export const savedFood = (
	food: Pick<SavedFood, 'name' | 'per100g'> & Partial<SavedFood>,
): SavedFood => savedFoodSchema.parse(food)

export const toMemoryFoodContext = (food: SavedFood, ref: string): MemoryFoodContext => ({
	ref,
	name: food.name,
	aliases: food.aliases,
	per100g: food.per100g,
	pieceGrams: food.pieceGrams,
	defaultGrams: food.defaultGrams,
	category: food.category,
})

/**
 * The «Saved foods» block of the request: the foods the message names, as the backend picks them
 * (findMentionedFoods), numbered m1…
 */
export const selectPassiveMemory = (
	foods: readonly SavedFood[],
	text: string,
): MemoryFoodContext[] =>
	findMentionedFoods(text, foods, {
		limit: MEMORY_PASSIVE_MAX_FOODS,
		minScore: MEMORY_PASSIVE_MIN_SCORE,
	}).map((food, index) => toMemoryFoodContext(food, `${SAVED_FOOD_REF_PREFIX}${index + 1}`))

export interface ReadFixtures {
	data: FindFoodData
	/** The foods behind the keys of `data.saved`, to turn an issued ref into the context item. */
	savedByKey: ReadonlyMap<string, SavedFood>
	historyByKey: ReadonlyMap<string, FindFoodHistoryEntry>
}

/** Entries of the last FIND_FOOD_HISTORY_DAYS days before the case's today, as the backend searches. */
export const getReadFixtures = (evalCase: EvalCase): ReadFixtures => {
	const today = getCaseToday(evalCase.context)
	const savedFoods = evalCase.savedFoods ?? []
	const saved = savedFoods.map((food, index): FindFoodSavedFood => ({
		key: toSavedKey(index),
		name: food.name,
		aliases: food.aliases,
		per100g: food.per100g,
		pieceGrams: food.pieceGrams,
		defaultGrams: food.defaultGrams,
		category: food.category,
		usageCount: food.usageCount,
		lastUsedAt: null,
	}))
	const history = (evalCase.historyEntries ?? [])
		.map((entry, index): FindFoodHistoryEntry => ({
			key: toHistoryKey(index),
			date: entry.date,
			mealType: entry.mealType,
			name: entry.name,
			grams: entry.grams,
			kcal: entry.kcal,
			source: entry.source,
			count: entry.count ?? 1,
		}))
		.filter(({ date }) => {
			const offset = getDayOffset(date, today)
			return offset >= -FIND_FOOD_HISTORY_DAYS && offset <= -1
		})
	return {
		data: { saved, history },
		savedByKey: new Map(saved.map((food, index) => [food.key, savedFoods[index] as SavedFood])),
		historyByKey: new Map(history.map((entry) => [entry.key, entry])),
	}
}
