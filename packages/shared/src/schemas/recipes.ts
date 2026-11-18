import { z } from 'zod'

import { foodCategorySchema, mealTypeSchema } from './enums.js'
import { foodEntryResponseSchema } from './messages.js'

export const RECIPES_PAGE_LIMIT_MAX = 50
export const RECIPES_PAGE_LIMIT_DEFAULT = 20

/** `:id` of /recipes/:id routes. */
export const recipeParamsSchema = z.object({ id: z.uuid() })

export type RecipeParams = z.infer<typeof recipeParamsSchema>

export const recipesQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce
		.number()
		.int()
		.positive()
		.max(RECIPES_PAGE_LIMIT_MAX)
		.default(RECIPES_PAGE_LIMIT_DEFAULT),
})

export type RecipesQuery = z.infer<typeof recipesQuerySchema>

/** ½ / 1 / 1½ of the recipe portion. */
export const recipePortionShareSchema = z.union([z.literal(0.5), z.literal(1), z.literal(1.5)])

export type RecipePortionShare = z.infer<typeof recipePortionShareSchema>

const recipeValuesSchema = z.object({
	kcal: z.number(),
	protein: z.number(),
	fat: z.number(),
	carbs: z.number(),
})

/** Figures per one portion; the backend counts them. */
export const recipeListItemSchema = recipeValuesSchema.extend({
	id: z.uuid(),
	name: z.string(),
	category: foodCategorySchema,
	portionGrams: z.number(),
	usageCount: z.number().int(),
	lastUsedAt: z.iso.datetime().nullable(),
})

export type RecipeListItem = z.infer<typeof recipeListItemSchema>

export const recipeIngredientResponseSchema = recipeValuesSchema.extend({
	id: z.uuid(),
	name: z.string(),
	grams: z.number(),
})

export const recipePortionResponseSchema = recipeValuesSchema.extend({
	share: recipePortionShareSchema,
	grams: z.number(),
})

export const recipeDetailSchema = recipeListItemSchema.extend({
	cookedGrams: z.number(),
	ingredients: z.array(recipeIngredientResponseSchema),
	portions: z.array(recipePortionResponseSchema),
})

export type RecipeDetail = z.infer<typeof recipeDetailSchema>

/** Body of POST /recipes/:id/log. */
export const logRecipePortionRequestSchema = z.object({ share: recipePortionShareSchema })

export type LogRecipePortionRequest = z.infer<typeof logRecipePortionRequestSchema>

export const logRecipePortionResponseSchema = z.object({
	entry: foodEntryResponseSchema,
	mealType: mealTypeSchema,
	localDate: z.iso.date(),
})

export type LogRecipePortionResponse = z.infer<typeof logRecipePortionResponseSchema>
