import { FALLBACK_FOOD_CATEGORY, type FoodCategory } from '@/shared/ui'

export interface CategorizedEntry {
	category: FoodCategory | null | undefined
	kcal: number
}

/**
 * A meal's icon is the category of its most caloric entry — dinner with pizza → pizza
 * (design/docs/components.md). An empty meal or an uncategorised top entry gets the plate.
 */
export const getMealCategory = (entries: readonly CategorizedEntry[]): FoodCategory => {
	const top = entries.reduce<CategorizedEntry | null>(
		(best, entry) => (!best || entry.kcal > best.kcal ? entry : best),
		null,
	)
	return top?.category ?? FALLBACK_FOOD_CATEGORY
}
