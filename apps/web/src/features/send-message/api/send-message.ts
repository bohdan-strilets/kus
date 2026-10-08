import {
	createDataResponseSchema,
	type SendMessageRequest,
	type SendMessageResponse,
	sendMessageResponseSchema,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(sendMessageResponseSchema)

/**
 * The model answers in 2–13 s and the API gives it up to 2 min in total (docs/architecture.md),
 * far past the default 15 s; a bit more so the API's own 503 arrives instead of a client timeout.
 */
const SEND_TIMEOUT_MS = 130_000

export const postMessage = async (body: SendMessageRequest): Promise<SendMessageResponse> => {
	const response = await httpClient.post<unknown>('/messages', body, { timeout: SEND_TIMEOUT_MS })
	return responseSchema.parse(response.data).data
}
