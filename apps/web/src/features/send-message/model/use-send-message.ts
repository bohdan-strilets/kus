import { useQueryClient } from '@tanstack/react-query'

import { createSessionObjectUrl, createUuid, unlockSound } from '@/shared/lib'

import { deliverMessage } from './deliver-message'
import type { OutboxPhoto } from './outbox-store'
import type { PhotoDraftPhoto } from './photo-draft-store'

export interface SendMessageActions {
	/** A new message: a fresh clientMessageId. */
	send: (params: { text: string; photo?: PhotoDraftPhoto | null }) => void
	/** «Спробувати ще»: the same id, text and photo as the failed try. */
	retry: (params: { clientMessageId: string; text: string; photo?: OutboxPhoto }) => void
}

const toOutboxPhoto = ({ blob, base64, width, height }: PhotoDraftPhoto): OutboxPhoto => ({
	previewUrl: createSessionObjectUrl(blob),
	base64,
	mimeType: 'image/jpeg',
	width,
	height,
})

/**
 * Both actions run inside the tap on «надіслати» / «Спробувати ще», so they unlock the audio first:
 * iOS lets a page start sound only within a user gesture, and the «кусь» itself plays after the
 * API answers, long after the gesture is over (design/docs/sounds.md, rule 2).
 */
export const useSendMessage = (): SendMessageActions => {
	const queryClient = useQueryClient()
	return {
		send: ({ text, photo }) => {
			unlockSound()
			void deliverMessage(queryClient, {
				clientMessageId: createUuid(),
				text: text.trim(),
				// its own blob URL: the draft revokes its one the moment it is cleared
				photo: photo ? toOutboxPhoto(photo) : undefined,
			})
		},
		retry: (params) => {
			unlockSound()
			void deliverMessage(queryClient, { ...params, isRetry: true })
		},
	}
}
