import { createDataResponseSchema, type DayResponse, dayResponseSchema } from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(dayResponseSchema)

export const getDay = async (localDate: string): Promise<DayResponse> => {
	const response = await httpClient.get<unknown>(`/days/${localDate}`)
	return responseSchema.parse(response.data).data
}
