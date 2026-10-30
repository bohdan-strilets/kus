import {
	createPaginatedResponseSchema,
	type MyFoodResponse,
	myFoodResponseSchema,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createPaginatedResponseSchema(myFoodResponseSchema)

/** The whole list in one page: the screen filters it itself (the API caps a page at 500). */
export const getMyFoods = async (): Promise<MyFoodResponse[]> => {
	const response = await httpClient.get<unknown>('/my-foods')
	return responseSchema.parse(response.data).data
}
