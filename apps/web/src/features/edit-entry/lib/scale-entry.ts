import { type EntryValues, type FoodEntryResponse, getCorrectedValues } from '@kus/shared'

const toEntryValues = (entry: FoodEntryResponse): EntryValues => ({
	grams: entry.grams,
	kcal: entry.kcal,
	protein: entry.protein,
	fat: entry.fat,
	carbs: entry.carbs,
	fiber: entry.fiber,
})

/** The entry at another weight, by its density — the same numbers the API will store. */
export const getScaledValues = (entry: FoodEntryResponse, grams: number): EntryValues =>
	getCorrectedValues(toEntryValues(entry), { grams, values: null })
