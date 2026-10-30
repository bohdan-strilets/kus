import {
	createDataResponseSchema,
	type RememberEntriesRequest,
	type RememberEntriesResponse,
	rememberEntriesResponseSchema,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(rememberEntriesResponseSchema)

/** Saves the logged entries as «Мої продукти»; the ones already saved come back as skipped. */
export const postRememberEntries = async (
	body: RememberEntriesRequest,
): Promise<RememberEntriesResponse> => {
	const response = await httpClient.post<unknown>('/my-foods/from-entries', body)
	return responseSchema.parse(response.data).data
}
