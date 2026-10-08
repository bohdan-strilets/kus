import type { FoodEntryResponse } from '@kus/shared'

/** «Яйця, гречка, кава з молоком» — the meal's entries in the order they were logged. */
export const getMealSummary = (entries: readonly Pick<FoodEntryResponse, 'name'>[]): string =>
	entries.map((entry) => entry.name).join(', ')
