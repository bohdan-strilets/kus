import type { ChatMessage } from '@kus/shared'

import type { OutboxPhoto, SendError } from '@/features/send-message'

export type UserItemState = 'sent' | 'sending' | 'failed'

/** What «Спробувати ще» resends: the same id, text and photo, so the API never logs the food twice. */
export interface RetryParams {
	clientMessageId: string
	text: string
	photo?: OutboxPhoto
}

/** The picture in a user bubble: this device still has it, or only the fact that it was there. */
export type FeedPhoto = { kind: 'preview'; url: string } | { kind: 'placeholder' }

export type TypingPhase = 'uploading' | 'thinking'

export type FeedItem =
	| { kind: 'day'; key: string; localDate: string; label: 'today' | 'yesterday' | 'date' }
	| { kind: 'time'; key: string; at: string }
	| { kind: 'greeting'; key: string }
	| { kind: 'recap'; key: string; localDate: string }
	| {
			kind: 'user'
			key: string
			text: string
			state: UserItemState
			photo?: FeedPhoto
			/** 0..1 of the photo uploaded, while sending. */
			uploadProgress?: number
	  }
	/** photoStatus: how the photo of the message this answers went (it decides the face and sound). */
	| { kind: 'kusik'; key: string; message: ChatMessage; photoStatus?: 'PROCESSED' | 'FAILED' }
	/** Kusik's «ой» under a message that didn't go through; no retry when resending can't help. */
	| {
			kind: 'failure'
			key: string
			error: SendError
			retry: RetryParams | null
			/** A photo that did not survive a reload can not be resent: «Прибрати» drops the bubble. */
			dismiss: { clientMessageId: string } | null
	  }
	| { kind: 'typing'; key: string; phase: TypingPhase }
