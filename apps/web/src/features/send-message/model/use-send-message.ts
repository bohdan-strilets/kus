import type { OnboardingAnswerRequest } from '@kus/shared'
import { useQueryClient } from '@tanstack/react-query'

import { createSessionObjectUrl, createUuid, unlockSound } from '@/shared/lib'

import { deliverMessage } from './deliver-message'
import type { OutboxPhoto } from './outbox-store'
import type { PhotoDraftPhoto } from './photo-draft-store'

export interface SendMessageActions {
	/** A new message: a fresh clientMessageId. */
	send: (params: {
		text: string
		photo?: PhotoDraftPhoto | null
		/** A button of the training onboarding; `text` is its label. */
		onboardingAnswer?: OnboardingAnswerRequest
	}) => void
	/** «Спробувати ще»: the same id, text and photo as the failed try. */
	retry: (params: {
		clientMessageId: string
		text: string
		photo?: OutboxPhoto
		/** Already uploaded: the resend only sends the message. */
		photoId?: string
		onboardingAnswer?: OnboardingAnswerRequest
		/** Unsent over a day: the server logs it now, not on the day it was written. */
		sendNow?: boolean
	}) => void
}

const toOutboxPhoto = ({
	blob,
	base64,
	thumbBase64,
	width,
	height,
}: PhotoDraftPhoto): OutboxPhoto => ({
	previewUrl: createSessionObjectUrl(blob),
	base64,
	thumbBase64,
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
		send: ({ text, photo, onboardingAnswer }) => {
			unlockSound()
			void deliverMessage(queryClient, {
				clientMessageId: createUuid(),
				text: text.trim(),
				onboardingAnswer,
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
