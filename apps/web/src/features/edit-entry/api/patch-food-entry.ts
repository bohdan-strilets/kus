import {
	createDataResponseSchema,
	type FoodEntryResponse,
	foodEntryResponseSchema,
	type UpdateFoodEntryRequest,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(foodEntryResponseSchema)

/** A new weight (the API rescales kcal and macros) and/or another meal of the same day. */
export const patchFoodEntry = async ({
	id,
	...body
}: UpdateFoodEntryRequest & { id: string }): Promise<FoodEntryResponse> => {
	const response = await httpClient.patch<unknown>(`/food-entries/${id}`, body)
	return responseSchema.parse(response.data).data
}
