import { normalizeName } from '@kus/shared'

import type { FoodEntry, MyFood, MyFoodSource } from '../../generated/prisma/client'
import { roundNutrition } from '../entries/entries.mapper'

const GRAMS_PER_100 = 100

/** A new food as the repository stores it. */
export type NewMyFood = Pick<
	MyFood,
	| 'name'
	| 'nameNormalized'
	| 'kcalPer100g'
	| 'proteinPer100g'
	| 'fatPer100g'
	| 'carbsPer100g'
	| 'fiberPer100g'
	| 'pieceGrams'
	| 'defaultGrams'
	| 'category'
	| 'source'
>

const toPer100g = (value: number, grams: number): number =>
	roundNutrition((value / grams) * GRAMS_PER_100)

const toFoodSource = (source: FoodEntry['source']): MyFoodSource => {
	if (source === 'LABEL') return 'LABEL'
	if (source === 'MANUAL') return 'MANUAL'
	return 'AI'
}

/**
 * A saved food from a logged entry: per-100 g values scaled back from the portion, «1 шт» from
 * the entry's quantity, the portion itself as the usual one.
 */
export const toNewMyFood = (entry: FoodEntry): NewMyFood => ({
	name: entry.name,
	nameNormalized: normalizeName(entry.name),
	kcalPer100g: toPer100g(entry.kcal, entry.grams),
	proteinPer100g: toPer100g(entry.proteinG, entry.grams),
	fatPer100g: toPer100g(entry.fatG, entry.grams),
	carbsPer100g: toPer100g(entry.carbsG, entry.grams),
	fiberPer100g: entry.fiberG === null ? null : toPer100g(entry.fiberG, entry.grams),
	pieceGrams:
		entry.quantity !== null && entry.quantity > 0
			? roundNutrition(entry.grams / entry.quantity)
			: null,
	defaultGrams: entry.grams,
	category: entry.category,
	source: toFoodSource(entry.source),
})

/** The search of the list: the query is a part of the name or of any alias (both stored normalized). */
export const isFoodMatchingQuery = (
	food: Pick<MyFood, 'nameNormalized' | 'aliases'>,
	query: string,
): boolean => {
	const normalized = normalizeName(query)
	if (normalized === '') return true
	return (
		food.nameNormalized.includes(normalized) ||
		food.aliases.some((alias) => alias.includes(normalized))
	)
}

export const compareByName = (
	a: Pick<MyFood, 'nameNormalized'>,
	b: Pick<MyFood, 'nameNormalized'>,
): number => a.nameNormalized.localeCompare(b.nameNormalized, 'uk')
