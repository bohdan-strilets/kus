import { type FoodCategory, isLiquidCategory } from '@kus/shared'

/** Drinks are measured in ml; their grams hold the volume (packages/shared food-units). */
export type AmountUnit = 'g' | 'ml'

export const getAmountUnit = (category: FoodCategory): AmountUnit =>
	isLiquidCategory(category) ? 'ml' : 'g'
