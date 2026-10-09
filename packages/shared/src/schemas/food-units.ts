import type { FoodCategory } from './enums.js'

/**
 * Categories that are drunk, not eaten. Their `grams` hold the volume in ml (≈ g for drinks, as
 * log_food asks), so the app shows «250 мл» instead of «250 г» — no separate unit is stored.
 * Yogurt and the rest of dairy stay in grams: they are eaten with a spoon.
 */
export const LIQUID_FOOD_CATEGORIES: readonly FoodCategory[] = [
	'coffee',
	'tea',
	'juice',
	'soda',
	'alcohol',
	'milk',
	'protein_shake',
]

export const isLiquidCategory = (category: FoodCategory): boolean =>
	LIQUID_FOOD_CATEGORIES.includes(category)
