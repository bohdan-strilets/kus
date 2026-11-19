import {
	getCookedGrams,
	isRecipeDensityValid,
	MAX_ENTRY_GRAMS,
	MIN_ENTRY_GRAMS,
	normalizeName,
	RECIPE_COOKED_GRAMS_MAX,
	type RecipeCookedInput,
	type RecipeBody,
	type RecipeDraft,
	recipeDraftSchema,
} from '@kus/shared'

import { roundNutrition } from '../entries/entries.mapper'

/** The water or weight a user said the pot really had; what was not said stays as it was. */
export interface PotCorrection {
	waterMl: number | null
	cookedGrams: number | null
}

const isPositive = (value: number | null): value is number => value !== null && value > 0

/** A draft read back from the database; null = the JSON is not a composition (never cast, never trusted). */
export const parseRecipeDraft = (value: unknown): RecipeDraft | null => {
	const result = recipeDraftSchema.safeParse(value)
	return result.success ? result.data : null
}

/**
 * The pot as its portions keep it. A pot told only by its plates ("6 тарілок") has no weight of its
 * own: it becomes the plates × the portion eaten, so a later portion of another size is counted from the
 * same weight instead of from the ingredients alone.
 */
export const toPotDraft = (body: RecipeBody, portionGrams: number): RecipeDraft => {
	const hasSize = isPositive(body.cookedGrams) || isPositive(body.waterMl)
	if (hasSize || body.servings === null) return body
	return {
		...body,
		cookedGrams: Math.min(roundNutrition(body.servings * portionGrams), RECIPE_COOKED_GRAMS_MAX),
	}
}

/**
 * The corrected pot: new water replaces a stated weight (the weight would hide it), a new weight
 * stands next to the water.
 */
export const applyPotCorrection = (draft: RecipeDraft, correction: PotCorrection): RecipeDraft => ({
	...draft,
	waterMl: correction.waterMl ?? draft.waterMl,
	cookedGrams: correction.cookedGrams ?? (correction.waterMl === null ? draft.cookedGrams : null),
})

/** A portion is a valid entry: 0.1–5000 g of a dish not denser than 9.5 kcal/g. */
export const isPotPortionValid = (input: RecipeCookedInput, grams: number): boolean =>
	grams >= MIN_ENTRY_GRAMS &&
	grams <= MAX_ENTRY_GRAMS &&
	getCookedGrams(input) > 0 &&
	isRecipeDensityValid(input)

/** One portion of a saved recipe: the grams the model said, else the pot divided by its servings. */
export const getRecipePortionGrams = (
	body: RecipeBody,
	portionGrams: number | null,
): number | null => {
	if (portionGrams !== null) return portionGrams
	if (body.servings === null) return null
	return roundNutrition(getCookedGrams(body) / body.servings)
}

/** Stored like the name: normalized; the name itself and repeats are not aliases. */
export const toRecipeAliases = (aliases: readonly string[], nameNormalized: string): string[] => [
	...new Set(
		aliases.map(normalizeName).filter((alias) => alias !== '' && alias !== nameNormalized),
	),
]
