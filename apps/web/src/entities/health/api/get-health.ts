import { createDataResponseSchema, type HealthResponse, healthResponseSchema } from '@kus/shared'

import { httpClient } from '@/shared/api'

const healthEnvelopeSchema = createDataResponseSchema(healthResponseSchema)

export const getHealth = async (): Promise<HealthResponse> => {
	const response = await httpClient.get<unknown>('/health')
	return healthEnvelopeSchema.parse(response.data).data
}
