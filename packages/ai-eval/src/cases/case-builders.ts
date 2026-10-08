import type { FoodCategory, LoggableMealType, TodayEntryContext } from '@kus/shared'

import type { ExpectedValue } from './case.types.js'

const DECIMALS = 10

/** Value for a weighed portion from per-100 g reference data. */
export const per100 = (valuePer100g: number, grams: number): ExpectedValue => ({
	exact: Math.round(((valuePer100g * grams) / 100) * DECIMALS) / DECIMALS,
})

export const exact = (value: number): ExpectedValue => ({ exact: value })

export const range = (min: number, max: number): ExpectedValue => ({ min, max })

const round = (value: number): number => Math.round(value * DECIMALS) / DECIMALS

/** Energy split of a typical mixed dish, used when a case doesn't care about the macros. */
const DEFAULT_SPLIT = { protein: 0.2, fat: 0.3, carbs: 0.5 } as const

/** A logged entry of the day context (`e1`…), macros adding up to its kcal unless given. */
export const entry = (
	ref: string,
	name: string,
	mealType: LoggableMealType,
	grams: number,
	kcal: number,
	category: FoodCategory,
	macros: Partial<Pick<TodayEntryContext, 'protein' | 'fat' | 'carbs'>> = {},
): TodayEntryContext => ({
	ref,
	name,
	mealType,
	grams,
	kcal,
	protein: macros.protein ?? round((kcal * DEFAULT_SPLIT.protein) / 4),
	fat: macros.fat ?? round((kcal * DEFAULT_SPLIT.fat) / 9),
	carbs: macros.carbs ?? round((kcal * DEFAULT_SPLIT.carbs) / 4),
	fiber: null,
	category,
	source: 'ESTIMATE',
})
