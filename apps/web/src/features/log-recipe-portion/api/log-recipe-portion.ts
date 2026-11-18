import {
	createDataResponseSchema,
	type LogRecipePortionResponse,
	logRecipePortionResponseSchema,
	type RecipePortionShare,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(logRecipePortionResponseSchema)

export interface LogRecipePortionParams {
	id: string
	share: RecipePortionShare
}

export const logRecipePortion = async ({
	id,
	share,
}: LogRecipePortionParams): Promise<LogRecipePortionResponse> => {
	const response = await httpClient.post<unknown>(`/recipes/${id}/log`, { share })
	return responseSchema.parse(response.data).data
}
