import type { FoodEntryResponse, LoggedMeal } from '@kus/shared'

/** What the form did to its entry: the meal in the sheet's picker has to follow without a refetch. */
export type EntryChange =
	{ kind: 'removed'; entryId: string } | { kind: 'updated'; entry: FoodEntryResponse }

const sum = (entries: readonly FoodEntryResponse[], pick: (entry: FoodEntryResponse) => number) =>
	entries.reduce((total, entry) => total + pick(entry), 0)

/**
 * The meal as it is after the change, or null when no entries are left. `totals` keep summing exactly
 * the entries shown; the share of other messages in `mealTotalKcal` stays, only the change moves it.
 */
export const applyEntryChange = (meal: LoggedMeal, change: EntryChange): LoggedMeal | null => {
	const entries =
		change.kind === 'removed'
			? meal.entries.filter((entry) => entry.id !== change.entryId)
			: meal.entries.map((entry) => (entry.id === change.entry.id ? change.entry : entry))
	if (entries.length === 0) return null

	const kcal = sum(entries, (entry) => entry.kcal)
	return {
		...meal,
		entries,
		totals: {
			...meal.totals,
			kcal,
			protein: sum(entries, (entry) => entry.protein),
			carbs: sum(entries, (entry) => entry.carbs),
			fat: sum(entries, (entry) => entry.fat),
			fiber: sum(entries, (entry) => entry.fiber ?? 0),
		},
		mealTotalKcal:
			meal.mealTotalKcal === null ? null : meal.mealTotalKcal + kcal - meal.totals.kcal,
	}
}
