import {
	type ChatMessage,
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createCursorPaginatedResponseSchema(chatMessageSchema)

export interface MessagesPage {
	/** Newest first, as the API sends them. */
	messages: ChatMessage[]
	/** The next, older page; null at the start of the chat. */
	nextCursor: string | null
}

export const getMessages = async (cursor: string | null): Promise<MessagesPage> => {
	const response = await httpClient.get<unknown>('/messages', {
		params: cursor === null ? {} : { cursor },
	})
	const { data, meta } = responseSchema.parse(response.data)
	return { messages: data, nextCursor: meta.nextCursor }
}
