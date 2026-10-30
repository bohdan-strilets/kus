import {
	createDataResponseSchema,
	type MyFoodResponse,
	myFoodResponseSchema,
	type UpdateMyFoodRequest,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(myFoodResponseSchema)

export const patchMyFood = async ({
	id,
	...body
}: UpdateMyFoodRequest & { id: string }): Promise<MyFoodResponse> => {
	const response = await httpClient.patch<unknown>(`/my-foods/${id}`, body)
	return responseSchema.parse(response.data).data
}
