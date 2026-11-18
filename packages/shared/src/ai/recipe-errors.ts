// What the parser rejects in recipes: the pot of a log_food item and save_recipe. Shared, so the
// backend and the eval judge the same way; the model gets the text on the retry.
import { isRecipeDensityValid, type RecipeCookedInput } from './recipe-values.js'
import { MAX_KCAL_PER_GRAM } from '../schemas/food-entry.js'
import type { RecipeBody } from '../schemas/recipe-body.js'
import type { ParseRefs } from './entry-edits.js'
import { MAX_SAVED_RECIPES_PER_MESSAGE, type SaveRecipeInput } from './recipe-tools.js'
import type { LogFoodInput } from './tools.js'

/** Categories of a pot with water: its weight is unknown unless the model gives water, weight or servings. */
const WATERY_CATEGORIES: ReadonlySet<string> = new Set(['soup', 'borscht'])

const EMPTY_REFS: ReadonlySet<string> = new Set()

const hasPotSize = ({ waterMl, cookedGrams, servings }: RecipeBody): boolean =>
	waterMl !== null || cookedGrams !== null || servings !== null

const getDensityErrors = (prefix: string, recipe: RecipeCookedInput): string[] =>
	isRecipeDensityValid(recipe)
		? []
		: [
				`${prefix} is denser than ${MAX_KCAL_PER_GRAM} kcal per gram — check the ingredients, waterMl or cookedGrams`,
			]

/** log_food items with `recipe` or `recipeRef`: what may go together, and the pot's size. */
export const getLogRecipeErrors = (
	log: LogFoodInput,
	{ recipeRefs = EMPTY_REFS }: Pick<ParseRefs, 'recipeRefs'>,
): string[] =>
	log.items.flatMap((item, index) => {
		const prefix = `log_food: items.${index}`
		const errors: string[] = []
		const { recipe, recipeRef } = item
		if (
			recipe !== null &&
			(item.memoryRef !== null || item.copyRef !== null || recipeRef !== null)
		) {
			errors.push(`${prefix} has recipe together with memoryRef, copyRef or recipeRef — use one`)
		}
		if (recipeRef !== null && (item.memoryRef !== null || item.copyRef !== null)) {
			errors.push(`${prefix} has recipeRef together with memoryRef or copyRef — use one`)
		}
		if (recipeRef !== null && !recipeRefs.has(recipeRef)) {
			errors.push(`${prefix}.recipeRef "${recipeRef}" is not in "Saved recipes" or find_food`)
		}
		if (recipe === null) return errors
		if (WATERY_CATEGORIES.has(item.category) && !hasPotSize(recipe)) {
			errors.push(
				`${prefix}.recipe: a soup needs waterMl, cookedGrams or servings — set waterMl to the water most likely for this dish and ask with clarify, or ask the user`,
			)
		}
		return [...errors, ...getDensityErrors(`${prefix}.recipe`, recipe)]
	})

const getSaveRecipeErrorsOf = (
	recipe: SaveRecipeInput,
	index: number,
	refs: Pick<ParseRefs, 'entries'>,
): string[] => {
	const prefix = `save_recipe: recipes.${index}`
	const { entryRef, recipe: body } = recipe
	if ((entryRef === null) === (body === null)) {
		return [`${prefix} needs exactly one of entryRef or recipe`]
	}
	if (entryRef !== null) {
		return refs.entries.has(entryRef)
			? []
			: [`${prefix}.entryRef "${entryRef}" is not in "Today's entries"`]
	}
	if (body === null) return []
	// the portion of a saved recipe is never guessed by the backend: the model says it, or it is the
	// pot divided by the plates
	const isPortionKnown =
		recipe.portionGrams !== null || (body.cookedGrams !== null && body.servings !== null)
	return [
		...(isPortionKnown
			? []
			: [
					`${prefix} needs portionGrams, or cookedGrams with servings — ask the user for the weight of a portion`,
				]),
		...getDensityErrors(`${prefix}.recipe`, { ...body, portionGrams: recipe.portionGrams }),
	]
}

export const getSaveRecipeErrors = (
	recipes: readonly SaveRecipeInput[],
	refs: Pick<ParseRefs, 'entries'>,
): string[] => {
	const errors =
		recipes.length > MAX_SAVED_RECIPES_PER_MESSAGE
			? [`save_recipe: at most ${MAX_SAVED_RECIPES_PER_MESSAGE} per message`]
			: []
	return [
		...errors,
		...recipes.flatMap((recipe, index) => getSaveRecipeErrorsOf(recipe, index, refs)),
	]
}
