import { createPaginatedResponseSchema, type RecipesQuery, recipeListItemSchema } from '@kus/shared'
import type { z } from 'zod'

import { httpClient } from '@/shared/api'

const responseSchema = createPaginatedResponseSchema(recipeListItemSchema)

export type RecipesPage = z.infer<typeof responseSchema>

export const getRecipes = async (params: Partial<RecipesQuery> = {}): Promise<RecipesPage> => {
	const response = await httpClient.get<unknown>('/recipes', { params })
	return responseSchema.parse(response.data)
}
