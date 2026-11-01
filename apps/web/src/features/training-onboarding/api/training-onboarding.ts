import { type ChatMessage, chatMessageSchema, createDataResponseSchema } from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(chatMessageSchema)

/** «Налаштувати в чаті» / «Так»: the first question, or the one that is still open. */
export const startTrainingOnboarding = async (): Promise<ChatMessage> => {
	const response = await httpClient.post<unknown>('/programs/onboarding/start')
	return responseSchema.parse(response.data).data
}

/** «Пізніше»: the invitation is never offered again (204). */
export const dismissTrainingOnboarding = async (): Promise<void> => {
	await httpClient.post('/programs/onboarding/dismiss')
}
