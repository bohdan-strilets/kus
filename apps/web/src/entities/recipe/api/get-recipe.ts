import { createDataResponseSchema, type RecipeDetail, recipeDetailSchema } from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(recipeDetailSchema)

export const getRecipe = async (id: string): Promise<RecipeDetail> => {
	const response = await httpClient.get<unknown>(`/recipes/${id}`)
	return responseSchema.parse(response.data).data
}
