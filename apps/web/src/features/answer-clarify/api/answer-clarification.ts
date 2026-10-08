import { type ChatMessage, chatMessageSchema, createDataResponseSchema } from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(chatMessageSchema)

/** The tapped answer; the API re-logs the entries and returns the message with its new card. */
export const postClarificationAnswer = async ({
	clarificationId,
	optionIndex,
}: {
	clarificationId: string
	optionIndex: number
}): Promise<ChatMessage> => {
	const response = await httpClient.post<unknown>(`/clarifications/${clarificationId}/answer`, {
		optionIndex,
	})
	return responseSchema.parse(response.data).data
}
