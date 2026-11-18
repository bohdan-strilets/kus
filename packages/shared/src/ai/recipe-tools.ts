// The recipe tool save_recipe. Like the memory tools it never answers on its own: a reply (or
// log_food) in the same turn does. The model points at a pot logged today by its ref (`e1`), or
// sends the ingredients itself.
// After any change here: run `pnpm --filter ai-eval eval` and add a line to PROMPT_CHANGELOG.md.
import { z } from 'zod'

import { FALLBACK_FOOD_CATEGORY, foodCategorySchema } from '../schemas/enums.js'
import { MAX_ENTRY_GRAMS, MIN_ENTRY_GRAMS } from '../schemas/food-entry.js'
import { MY_FOOD_NAME_MAX_LENGTH } from '../schemas/my-foods.js'
import { recipeBodySchema } from '../schemas/recipe-body.js'
import { ENTRY_REF_PATTERN } from './edit-tools.js'
import { withOpenEnumForModel } from './model-schema.js'

/** Refs the backend gives the saved recipes in the model context (`r1`…), never database ids. */
export const RECIPE_REF_PATTERN = /^r\d{1,3}$/

/** A message saves one pot: the reply names it, and a second one would replace the first by name. */
export const MAX_SAVED_RECIPES_PER_MESSAGE = 1
export const MAX_RECIPE_ALIASES = 5

export const saveRecipeInputSchema = z.object({
	name: z.string().trim().min(1).max(MY_FOOD_NAME_MAX_LENGTH),
	aliases: z
		.array(z.string().trim().min(1).max(MY_FOOD_NAME_MAX_LENGTH))
		.max(MAX_RECIPE_ALIASES)
		.default([]),
	// the model sees no list here (it has log_food's); an unknown category costs only an icon
	category: withOpenEnumForModel(foodCategorySchema.catch(FALLBACK_FOOD_CATEGORY), ''),
	entryRef: z.string().regex(ENTRY_REF_PATTERN).nullable().default(null),
	recipe: recipeBodySchema.nullable().default(null),
	portionGrams: z
		.number()
		.min(MIN_ENTRY_GRAMS)
		.max(MAX_ENTRY_GRAMS)
		.nullable()
		.default(null)
		.describe('Weight of one portion, g, when the user said it'),
})

export type SaveRecipeInput = z.infer<typeof saveRecipeInputSchema>
