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

interface PostMessageOptions {
	/** 0..1 while the body (a photo) is on its way to the API. */
	onUploadProgress?: (ratio: number) => void
}

const toRatio = (loaded: number, total: number | undefined): number =>
	total ? Math.min(1, Math.max(0, loaded / total)) : 0

export const postMessage = async (
	body: SendMessageRequest,
	{ onUploadProgress }: PostMessageOptions = {},
): Promise<SendMessageResponse> => {
	const response = await httpClient.post<unknown>('/messages', body, {
		timeout: SEND_TIMEOUT_MS,
		onUploadProgress: onUploadProgress
			? (event) => {
					onUploadProgress(toRatio(event.loaded, event.total))
				}
			: undefined,
	})
	return responseSchema.parse(response.data).data
}
