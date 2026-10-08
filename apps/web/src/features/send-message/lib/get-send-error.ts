import { type ApiError, HTTP_STATUS } from '@/shared/api'

export type SendErrorKey =
	| 'chat.networkError'
	| 'errors.api.AI_UNAVAILABLE'
	| 'errors.api.MESSAGE_TOO_LONG'
	| 'errors.api.DAILY_LIMIT_REACHED'
	| 'errors.api.TOO_MANY_REQUESTS'
	| 'errors.api.MESSAGE_IN_PROGRESS'
	| 'errors.api.SERVER'
	| 'errors.api.UNKNOWN'

export interface SendError {
	messageKey: SendErrorKey
	/** «Спробувати ще» makes sense: the same text may go through next time. */
	canRetry: boolean
}

/** Codes whose resend would fail the same way: the text or the day has to change first. */
const FINAL_ERRORS: Partial<Record<string, SendErrorKey>> = {
	MESSAGE_TOO_LONG: 'errors.api.MESSAGE_TOO_LONG',
	DAILY_LIMIT_REACHED: 'errors.api.DAILY_LIMIT_REACHED',
}

const RETRIABLE_ERRORS: Partial<Record<string, SendErrorKey>> = {
	AI_UNAVAILABLE: 'errors.api.AI_UNAVAILABLE',
	// the per-minute throttler: a minute later the same message is fine
	TOO_MANY_REQUESTS: 'errors.api.TOO_MANY_REQUESTS',
	MESSAGE_IN_PROGRESS: 'errors.api.MESSAGE_IN_PROGRESS',
}

/** What Kusik's «ой» bubble says under a message that didn't go through. */
export const getSendError = (error: ApiError): SendError => {
	if (error.kind === 'network') return { messageKey: 'chat.networkError', canRetry: true }
	if (error.kind === 'unknown') return { messageKey: 'errors.api.UNKNOWN', canRetry: true }

	const final = FINAL_ERRORS[error.errorCode]
	if (final) return { messageKey: final, canRetry: false }
	const retriable = RETRIABLE_ERRORS[error.errorCode]
	if (retriable) return { messageKey: retriable, canRetry: true }
	if (error.status >= HTTP_STATUS.serverErrorMin) {
		return { messageKey: 'errors.api.SERVER', canRetry: true }
	}
	return { messageKey: 'errors.api.UNKNOWN', canRetry: true }
}

/** A message the server marked FAILED (seen after a reload): the reason is gone, a resend may work. */
export const STORED_FAILURE: SendError = { messageKey: 'errors.api.AI_UNAVAILABLE', canRetry: true }
