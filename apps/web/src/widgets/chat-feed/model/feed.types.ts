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

/** How the photo of a user message went on the server (it decides Kusik's face and the sound). */
export type FeedPhotoStatus = 'PROCESSED' | 'FAILED'

/**
 * What «Прибрати» drops: a draft of this device (by clientMessageId) or a server message whose
 * photo can't be resent (hidden by id).
 */
export type FeedDismiss = { target: 'outbox' | 'server'; id: string }

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
	| { kind: 'kusik'; key: string; message: ChatMessage; photoStatus?: FeedPhotoStatus }
	/** Kusik's «ой» under a message that didn't go through; no retry when resending can't help. */
	| {
			kind: 'failure'
			key: string
			error: SendError
			retry: RetryParams | null
			dismiss: FeedDismiss | null
	  }
	| { kind: 'typing'; key: string; phase: TypingPhase }
