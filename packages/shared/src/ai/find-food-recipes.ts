// find_food over the saved recipes: the same fuzzy search as for saved foods, the result lists the
// ingredients with grams (no macros) plus the portion and kcal per 100 g counted by the backend.
import { FOOD_SEARCH_MIN_SCORE, type FoodSearchCandidate, searchFoods } from './food-search.js'
import { toContextText } from './memory-context.js'

/** Most recipes one find_food call lists. */
export const FIND_FOOD_RECIPES_LIMIT = 5

export interface FindFoodRecipe {
	/** Opaque key of the recipe (its database id); the model never sees it. */
	key: string
	name: string
	aliases: readonly string[]
	portionGrams: number | null
	kcalPer100g: number
	ingredients: readonly { name: string; grams: number }[]
	usageCount: number
	lastUsedAt: Date | null
}

const round = (value: number): number => Math.round(value)

const toCandidate = (recipe: FindFoodRecipe): FoodSearchCandidate => ({
	ref: recipe.key,
	source: 'saved',
	name: recipe.name,
	aliases: recipe.aliases,
	usageCount: recipe.usageCount,
	lastUsedAt: recipe.lastUsedAt,
})

export const formatFoundRecipe = (recipe: FindFoodRecipe, ref: string): string => {
	const aliases =
		recipe.aliases.length > 0 ? ` (also: ${recipe.aliases.map(toContextText).join(', ')})` : ''
	const portion = recipe.portionGrams === null ? '' : `portion ${round(recipe.portionGrams)} g, `
	const ingredients = recipe.ingredients
		.map(({ name, grams }) => `${toContextText(name)} ${round(grams)} g`)
		.join(', ')
	return (
		`${ref} "${toContextText(recipe.name)}"${aliases} — recipe: ${portion}` +
		`${round(recipe.kcalPer100g)} kcal/100 g; ingredients: ${ingredients}`
	)
}

/** The best matches of the query, at most FIND_FOOD_RECIPES_LIMIT. */
export const searchRecipes = (
	query: string,
	recipes: readonly FindFoodRecipe[],
	now: Date,
): FindFoodRecipe[] => {
	const byKey = new Map(recipes.map((recipe) => [recipe.key, recipe]))
	return searchFoods(query, recipes.map(toCandidate), {
		limit: FIND_FOOD_RECIPES_LIMIT,
		minScore: FOOD_SEARCH_MIN_SCORE,
		now,
	}).flatMap(({ candidate }) => byKey.get(candidate.ref) ?? [])
}

/** The most used recipes, for «what do you remember» without a query. */
export const listRecipes = (recipes: readonly FindFoodRecipe[]): FindFoodRecipe[] =>
	[...recipes]
		.sort(
			(a, b) =>
				b.usageCount - a.usageCount ||
				(b.lastUsedAt?.getTime() ?? 0) - (a.lastUsedAt?.getTime() ?? 0),
		)
		.slice(0, FIND_FOOD_RECIPES_LIMIT)
