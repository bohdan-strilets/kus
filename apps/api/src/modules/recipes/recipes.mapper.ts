import {
	type FindFoodRecipe,
	getCookedGrams,
	getRecipeKcalPerGram,
	getRecipePortionValues,
	type RecipeContext,
	type RecipeCookedInput,
	type RecipeDetail,
	type RecipeListItem,
	type RecipePortionShare,
	type RecipeTotals,
} from '@kus/shared'

import { roundNutrition } from '../entries/entries.mapper'
import type { RecipeWithIngredients } from './recipes.repository'

const GRAMS_PER_100 = 100

/** Portions the detail screen offers: ½, 1, 1½. */
const PORTION_SHARES: RecipePortionShare[] = [0.5, 1, 1.5]

export const toCookedInput = (recipe: RecipeWithIngredients): RecipeCookedInput => ({
	ingredients: recipe.ingredients.map((ingredient) => ({
		grams: ingredient.grams,
		kcal: ingredient.kcal,
		protein: ingredient.proteinG,
		fat: ingredient.fatG,
		carbs: ingredient.carbsG,
	})),
	cookedGrams: recipe.cookedGrams,
})

/**
 * One portion: the saved defaultGrams. A recipe without it has no portion size to guess from
 * (servings isn't stored), so the whole finished dish counts as one portion: an honest number,
 * and an oversized one is rejected by the 5000 g guard when it is logged.
 */
export const getPortionGrams = (recipe: RecipeWithIngredients): number =>
	recipe.defaultGrams ?? getCookedGrams(toCookedInput(recipe))

/** Kcal per 100 g of the finished dish, counted from the ingredients and the dish's weight. */
const getKcalPer100g = (recipe: RecipeWithIngredients): number =>
	getRecipeKcalPerGram(toCookedInput(recipe)) * GRAMS_PER_100

/** A recipe as the "Saved recipes" block shows it. */
export const toRecipeContext = (recipe: RecipeWithIngredients, ref: string): RecipeContext => ({
	ref,
	name: recipe.name,
	portionGrams: recipe.defaultGrams,
	kcalPer100g: getKcalPer100g(recipe),
})

/** A recipe as find_food lists it: ingredients with grams, no macros. */
export const toFindFoodRecipe = (recipe: RecipeWithIngredients): FindFoodRecipe => ({
	key: recipe.id,
	name: recipe.name,
	aliases: recipe.aliases,
	portionGrams: recipe.defaultGrams,
	kcalPer100g: getKcalPer100g(recipe),
	ingredients: recipe.ingredients.map(({ name, grams }) => ({ name, grams })),
	usageCount: recipe.usageCount,
	lastUsedAt: recipe.lastUsedAt,
})

const roundValues = (values: RecipeTotals): RecipeTotals => ({
	kcal: roundNutrition(values.kcal),
	protein: roundNutrition(values.protein),
	fat: roundNutrition(values.fat),
	carbs: roundNutrition(values.carbs),
})

export const toRecipeListItem = (recipe: RecipeWithIngredients): RecipeListItem => {
	const portionGrams = getPortionGrams(recipe)
	return {
		id: recipe.id,
		name: recipe.name,
		category: recipe.category,
		portionGrams: roundNutrition(portionGrams),
		...roundValues(getRecipePortionValues(toCookedInput(recipe), portionGrams)),
		usageCount: recipe.usageCount,
		lastUsedAt: recipe.lastUsedAt?.toISOString() ?? null,
	}
}

export const toRecipeDetail = (recipe: RecipeWithIngredients): RecipeDetail => {
	const input = toCookedInput(recipe)
	const portionGrams = getPortionGrams(recipe)
	return {
		...toRecipeListItem(recipe),
		cookedGrams: roundNutrition(getCookedGrams(input)),
		ingredients: recipe.ingredients.map((ingredient) => ({
			id: ingredient.id,
			name: ingredient.name,
			grams: ingredient.grams,
			kcal: ingredient.kcal,
			protein: ingredient.proteinG,
			fat: ingredient.fatG,
			carbs: ingredient.carbsG,
		})),
		portions: PORTION_SHARES.map((share) => {
			const grams = share * portionGrams
			return {
				share,
				grams: roundNutrition(grams),
				...roundValues(getRecipePortionValues(input, grams)),
			}
		}),
	}
}
