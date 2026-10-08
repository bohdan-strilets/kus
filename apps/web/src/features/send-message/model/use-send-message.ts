import { useQueryClient } from '@tanstack/react-query'

import { deliverMessage } from './deliver-message'

export interface SendMessageActions {
	/** A new message: a fresh clientMessageId. */
	send: (text: string) => void
	/** «Спробувати ще»: the same id and the same text as the failed try. */
	retry: (params: { clientMessageId: string; text: string }) => void
}

export const useSendMessage = (): SendMessageActions => {
	const queryClient = useQueryClient()
	return {
		send: (text) => {
			void deliverMessage(queryClient, { clientMessageId: crypto.randomUUID(), text: text.trim() })
		},
		retry: (params) => {
			void deliverMessage(queryClient, { ...params, isRetry: true })
		},
	}
}
