import { useQueryClient } from '@tanstack/react-query'

import { createUuid, unlockSound } from '@/shared/lib'

import { deliverMessage } from './deliver-message'

export interface SendMessageActions {
	/** A new message: a fresh clientMessageId. */
	send: (text: string) => void
	/** «Спробувати ще»: the same id and the same text as the failed try. */
	retry: (params: { clientMessageId: string; text: string }) => void
}

/**
 * Both actions run inside the tap on «надіслати» / «Спробувати ще», so they unlock the audio first:
 * iOS lets a page start sound only within a user gesture, and the «кусь» itself plays after the
 * API answers, long after the gesture is over (design/docs/sounds.md, rule 2).
 */
export const useSendMessage = (): SendMessageActions => {
	const queryClient = useQueryClient()
	return {
		send: (text) => {
			unlockSound()
			void deliverMessage(queryClient, { clientMessageId: createUuid(), text: text.trim() })
		},
		retry: (params) => {
			unlockSound()
			void deliverMessage(queryClient, { ...params, isRetry: true })
		},
	}
}
