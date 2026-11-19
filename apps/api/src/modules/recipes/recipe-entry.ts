import { type AiFoodItem, getRecipePortionValues, type RecipeBody } from '@kus/shared'

import type { NewFoodEntry } from '../entries/entries.types'
import { RecipePortionInvalidException } from './recipes.exceptions'
import { isPotPortionValid, toPotDraft } from './recipe-draft'
import { toCookedInput } from './recipes.mapper'
import type { RecipeWithIngredients } from './recipes.repository'

/** What the backend counts for a recipe portion; everything else of the entry stays the model's. */
type RecipePortionFields = Pick<
	NewFoodEntry,
	| 'kcal'
	| 'protein'
	| 'fat'
	| 'carbs'
	| 'fiber'
	| 'source'
	| 'myFoodId'
	| 'recipeId'
	| 'recipeDraft'
	| 'potId'
>

/** A portion of a pot the model sent as `recipe`: values from the composition, a new pot id, the draft kept. */
export const toPotEntry = (
	item: Pick<AiFoodItem, 'grams'>,
	body: RecipeBody,
	potId: string,
): RecipePortionFields => {
	const draft = toPotDraft(body, item.grams)
	if (!isPotPortionValid(draft, item.grams)) throw new RecipePortionInvalidException()
	const { kcal, protein, fat, carbs } = getRecipePortionValues(draft, item.grams)
	return {
		kcal,
		protein,
		fat,
		carbs,
		fiber: null,
		source: 'ESTIMATE',
		myFoodId: null,
		recipeId: null,
		recipeDraft: draft,
		potId,
	}
}

/** A portion of a saved recipe (`recipeRef`): its values scaled to `grams`; a pot is a new cooking, so no pot id. */
export const toSavedRecipeEntry = (
	recipe: RecipeWithIngredients,
	grams: number,
): RecipePortionFields => {
	const input = toCookedInput(recipe)
	if (!isPotPortionValid(input, grams)) throw new RecipePortionInvalidException()
	const { kcal, protein, fat, carbs } = getRecipePortionValues(input, grams)
	return {
		kcal,
		protein,
		fat,
		carbs,
		fiber: null,
		source: 'MEMORY',
		myFoodId: null,
		recipeId: recipe.id,
		potId: null,
	}
}
