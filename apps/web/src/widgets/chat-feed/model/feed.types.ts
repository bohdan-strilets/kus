import type { ChatMessage } from '@kus/shared'

import type { SendError } from '@/features/send-message'

export type UserItemState = 'sent' | 'sending' | 'failed'

/** What «Спробувати ще» resends: the same id and text, so the API never logs the food twice. */
export interface RetryParams {
	clientMessageId: string
	text: string
}

export type FeedItem =
	| { kind: 'day'; key: string; localDate: string; label: 'today' | 'yesterday' | 'date' }
	| { kind: 'time'; key: string; at: string }
	| { kind: 'greeting'; key: string }
	| { kind: 'recap'; key: string; localDate: string }
	| { kind: 'user'; key: string; text: string; state: UserItemState }
	| { kind: 'kusik'; key: string; message: ChatMessage }
	/** Kusik's «ой» under a message that didn't go through; no retry when resending can't help. */
	| { kind: 'failure'; key: string; error: SendError; retry: RetryParams | null }
	| { kind: 'typing'; key: string }
