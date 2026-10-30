import {
	createDataResponseSchema,
	type FactResponse,
	factResponseSchema,
	type UpdateFactRequest,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(factResponseSchema)

/** The server runs the same checks as the form (fact-guard, 120 characters, no duplicates). */
export const patchFact = async ({
	id,
	...body
}: UpdateFactRequest & { id: string }): Promise<FactResponse> => {
	const response = await httpClient.patch<unknown>(`/facts/${id}`, body)
	return responseSchema.parse(response.data).data
}

/** Soft delete: «Скасувати» in the toast brings it back. */
export const deleteFact = async (id: string): Promise<void> => {
	await httpClient.delete(`/facts/${id}`)
}

export const restoreFact = async (id: string): Promise<void> => {
	await httpClient.post(`/facts/${id}/restore`)
}
