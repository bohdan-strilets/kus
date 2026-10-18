import { createDataResponseSchema, type MeasurementCard, measurementCardSchema } from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(measurementCardSchema)

export const restoreMeasurement = async (id: string): Promise<MeasurementCard> => {
	const response = await httpClient.post<unknown>(`/measurements/${id}/restore`)
	return responseSchema.parse(response.data).data
}
