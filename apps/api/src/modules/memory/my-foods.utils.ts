import { normalizeName, type SaveFoodInput } from '@kus/shared'

import type { FoodEntry, MyFood, MyFoodSource, Prisma } from '../../generated/prisma/client'
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
> &
	Partial<Pick<MyFood, 'brand' | 'aliases'>>

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

/** Aliases are stored normalized like the name; the name itself and repeats are not aliases. */
const toAliases = (aliases: readonly string[], nameNormalized: string): string[] => [
	...new Set(
		aliases.map(normalizeName).filter((alias) => alias !== '' && alias !== nameNormalized),
	),
]

/**
 * A food the model saved with `save_food`: from the logged entry of `entry` (fromItemIndex) or
 * from the values it gave. The name and aliases are always the call's; the brand stays null (the model
 * is not asked for one). null = the call has
 * neither (the parser rejects that, so it is a defensive guard).
 */
export const toNewChatFood = (
	input: SaveFoodInput,
	{ entry, hasPhoto }: { entry: FoodEntry | undefined; hasPhoto: boolean },
): NewMyFood | null => {
	const nameNormalized = normalizeName(input.name)
	const identity = {
		name: input.name,
		nameNormalized,
		brand: null,
		aliases: toAliases(input.aliases, nameNormalized),
	}
	if (entry) {
		const derived = toNewMyFood(entry)
		return {
			...derived,
			...identity,
			pieceGrams: input.pieceGrams ?? derived.pieceGrams,
			defaultGrams: input.defaultGrams ?? derived.defaultGrams,
		}
	}
	const { per100g, category } = input
	if (!per100g || !category) return null
	return {
		...identity,
		kcalPer100g: roundNutrition(per100g.kcal),
		proteinPer100g: roundNutrition(per100g.protein),
		fatPer100g: roundNutrition(per100g.fat),
		carbsPer100g: roundNutrition(per100g.carbs),
		fiberPer100g: per100g.fiber === null ? null : roundNutrition(per100g.fiber),
		pieceGrams: input.pieceGrams,
		defaultGrams: input.defaultGrams,
		category,
		source: hasPhoto ? 'LABEL' : 'MANUAL',
	}
}

/** The update of an agreed `updateRef`: new values over the old; the name and unsaid optional fields stay. */
export const toMyFoodUpdate = (data: NewMyFood): Prisma.MyFoodUpdateManyMutationInput => ({
	kcalPer100g: data.kcalPer100g,
	proteinPer100g: data.proteinPer100g,
	fatPer100g: data.fatPer100g,
	carbsPer100g: data.carbsPer100g,
	fiberPer100g: data.fiberPer100g,
	category: data.category,
	source: data.source,
	...(data.pieceGrams !== null && { pieceGrams: data.pieceGrams }),
	...(data.defaultGrams !== null && { defaultGrams: data.defaultGrams }),
	...(data.aliases !== undefined && data.aliases.length > 0 && { aliases: data.aliases }),
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
