import { createDataResponseSchema, type FactResponse, factResponseSchema } from '@kus/shared'
import { z } from 'zod'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(z.array(factResponseSchema))

/** The confirmed facts; a proposal waiting for «Так / Ні» is not in the list. */
export const getFacts = async (): Promise<FactResponse[]> => {
	const response = await httpClient.get<unknown>('/facts')
	return responseSchema.parse(response.data).data
}
