import {
	type AnswerFactRequest,
	createDataResponseSchema,
	type FactResponse,
	factResponseSchema,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(factResponseSchema)

/** «Так» saves the proposed fact, «Ні» drops it; answering twice is a 409. */
export const answerFact = async ({
	id,
	accept,
}: AnswerFactRequest & { id: string }): Promise<FactResponse> => {
	const response = await httpClient.post<unknown>(`/facts/${id}/answer`, { accept })
	return responseSchema.parse(response.data).data
}
