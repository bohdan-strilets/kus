// The composition of a pot or a dish: what the model sends (log_food, save_recipe) and what a
// FoodEntry keeps as its draft. Lives apart from recipes.ts: that file imports messages.ts, which
// imports the AI tools, which import this one.
import { z } from 'zod'

import { foodEntryBaseSchema, MAX_ENTRY_GRAMS } from './food-entry.js'

export const RECIPE_INGREDIENTS_MAX = 30
export const RECIPE_WATER_ML_MAX = 20_000
export const RECIPE_COOKED_GRAMS_MAX = 30_000
export const RECIPE_SERVINGS_MAX = 30
/** A pinch of spice: lighter than a normal entry may be. */
export const RECIPE_INGREDIENT_MIN_GRAMS = 0.1

export const recipeIngredientInputSchema = z.object({
	name: foodEntryBaseSchema.shape.name,
	grams: z.number().min(RECIPE_INGREDIENT_MIN_GRAMS).max(MAX_ENTRY_GRAMS),
	kcal: foodEntryBaseSchema.shape.kcal,
	protein: foodEntryBaseSchema.shape.protein,
	fat: foodEntryBaseSchema.shape.fat,
	carbs: foodEntryBaseSchema.shape.carbs,
	fiber: foodEntryBaseSchema.shape.fiber,
})

export type RecipeIngredientInput = z.infer<typeof recipeIngredientInputSchema>

export const recipeBodySchema = z.object({
	ingredients: z.array(recipeIngredientInputSchema).min(1).max(RECIPE_INGREDIENTS_MAX),
	waterMl: z
		.number()
		.min(0)
		.max(RECIPE_WATER_ML_MAX)
		.nullable()
		.default(null)
		.describe('Water added to the pot, ml'),
	cookedGrams: z
		.number()
		.min(1)
		.max(RECIPE_COOKED_GRAMS_MAX)
		.nullable()
		.default(null)
		.describe('Weight of the finished dish, g, only if the user weighed it'),
	servings: z.int().min(1).max(RECIPE_SERVINGS_MAX).nullable().default(null),
})

export type RecipeBody = z.infer<typeof recipeBodySchema>

// FoodEntry.recipeDraft keeps the same body. Its pot id is the column food_entries.pot_id, never
// part of this JSON, and the grams of a portion are not here: they are save_recipe.portionGrams.
export const recipeDraftSchema = recipeBodySchema

export type RecipeDraft = RecipeBody
