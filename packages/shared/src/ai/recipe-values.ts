import { MAX_KCAL_PER_GRAM } from '../schemas/food-entry.js'

/** Share of the added water that boils off; 0 until the author's pots show a stable figure. */
export const EVAPORATION_SHARE = 0

export interface RecipeIngredientValues {
	grams: number
	kcal: number
	protein: number
	fat: number
	carbs: number
}

export interface RecipeTotals {
	kcal: number
	protein: number
	fat: number
	carbs: number
}

export interface RecipeCookedInput {
	/** Water is not an ingredient: it carries no kcal and is counted through `waterMl`. */
	ingredients: readonly RecipeIngredientValues[]
	waterMl?: number | null
	cookedGrams?: number | null
	servings?: number | null
	portionGrams?: number | null
}

const isPositive = (value: number | null | undefined): value is number =>
	value !== null && value !== undefined && value > 0

export const getRecipeTotals = (ingredients: readonly RecipeIngredientValues[]): RecipeTotals =>
	ingredients.reduce<RecipeTotals>(
		(totals, ingredient) => ({
			kcal: totals.kcal + ingredient.kcal,
			protein: totals.protein + ingredient.protein,
			fat: totals.fat + ingredient.fat,
			carbs: totals.carbs + ingredient.carbs,
		}),
		{ kcal: 0, protein: 0, fat: 0, carbs: 0 },
	)

const sumGrams = (ingredients: readonly RecipeIngredientValues[]): number =>
	ingredients.reduce((sum, ingredient) => sum + ingredient.grams, 0)

/** Weight of the finished dish: the stated weight, then the pot with its water, then servings. */
export const getCookedGrams = (input: RecipeCookedInput): number => {
	if (isPositive(input.cookedGrams)) return input.cookedGrams
	const ingredientsGrams = sumGrams(input.ingredients)
	if (isPositive(input.waterMl)) {
		return ingredientsGrams + input.waterMl * (1 - EVAPORATION_SHARE)
	}
	if (isPositive(input.servings) && isPositive(input.portionGrams)) {
		return input.servings * input.portionGrams
	}
	return ingredientsGrams
}

export const getRecipeKcalPerGram = (input: RecipeCookedInput): number => {
	const cookedGrams = getCookedGrams(input)
	return cookedGrams > 0 ? getRecipeTotals(input.ingredients).kcal / cookedGrams : 0
}

/** A pot denser than fat itself means a wrong weight or water, not a real dish. */
export const isRecipeDensityValid = (input: RecipeCookedInput): boolean =>
	getRecipeKcalPerGram(input) <= MAX_KCAL_PER_GRAM

/** Values of `grams` of the finished dish: totals × grams / cooked weight. */
export const getRecipePortionValues = (input: RecipeCookedInput, grams: number): RecipeTotals => {
	const cookedGrams = getCookedGrams(input)
	const totals = getRecipeTotals(input.ingredients)
	if (cookedGrams <= 0) return { kcal: 0, protein: 0, fat: 0, carbs: 0 }
	const ratio = grams / cookedGrams
	return {
		kcal: totals.kcal * ratio,
		protein: totals.protein * ratio,
		fat: totals.fat * ratio,
		carbs: totals.carbs * ratio,
	}
}
