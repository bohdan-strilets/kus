import {
	createDataResponseSchema,
	type MeasurementCard,
	measurementCardSchema,
	type UpdateMeasurementRequest,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(measurementCardSchema)

/** A corrected value; the API rounds it to a tenth and answers with the recomputed card. */
export const patchMeasurement = async ({
	id,
	...body
}: UpdateMeasurementRequest & { id: string }): Promise<MeasurementCard> => {
	const response = await httpClient.patch<unknown>(`/measurements/${id}`, body)
	return responseSchema.parse(response.data).data
}
