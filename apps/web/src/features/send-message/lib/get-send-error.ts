import { type ApiError, HTTP_STATUS } from '@/shared/api'

export type SendErrorKey =
	| 'chat.networkError'
	| 'errors.api.AI_UNAVAILABLE'
	| 'errors.api.MESSAGE_TOO_LONG'
	| 'errors.api.DAILY_LIMIT_REACHED'
	| 'errors.api.DAILY_PHOTO_LIMIT_REACHED'
	| 'errors.api.STORAGE_UNAVAILABLE'
	| 'errors.api.PHOTO_NOT_FOUND'
	| 'errors.api.PHOTO_IN_USE'
	| 'chat.photoNeedsNetwork'
	| 'chat.photoLost'
	| 'chat.photoTooLarge'
	| 'chat.photoUnsupported'
	| 'chat.photoInvalid'
	| 'errors.api.TOO_MANY_REQUESTS'
	| 'errors.api.MESSAGE_IN_PROGRESS'
	| 'errors.api.ENTRY_CHANGED'
	| 'errors.api.TURN_COPY_SOURCE_MISSING'
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
	DAILY_PHOTO_LIMIT_REACHED: 'errors.api.DAILY_PHOTO_LIMIT_REACHED',
	// the photo is already in another message: the same ids would fail the same way
	PHOTO_IN_USE: 'errors.api.PHOTO_IN_USE',
	// reaches here only when deliverMessage's quiet re-upload could not run or failed too
	PHOTO_NOT_FOUND: 'errors.api.PHOTO_NOT_FOUND',
}

/** The API's reason a photo was refused (details.fields.photo) → what Kusik says; resending won't help. */
const PHOTO_FIELD_ERRORS: Partial<Record<string, SendErrorKey>> = {
	PHOTO_TOO_LARGE: 'chat.photoTooLarge',
	UNSUPPORTED_IMAGE: 'chat.photoUnsupported',
	PHOTO_INVALID: 'chat.photoInvalid',
}

const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR'

/** POST /photos names the field it refused (the full photo or its thumbnail), POST /messages — `photo`. */
const PHOTO_FIELD_NAMES = ['photo', 'thumb'] as const

const getPhotoFieldError = (details: Record<string, unknown>): SendErrorKey | undefined => {
	const { fields } = details
	if (typeof fields !== 'object' || fields === null) return undefined
	for (const name of PHOTO_FIELD_NAMES) {
		const reason: unknown = name in fields ? (fields as Record<string, unknown>)[name] : undefined
		if (typeof reason === 'string' && PHOTO_FIELD_ERRORS[reason]) return PHOTO_FIELD_ERRORS[reason]
	}
	return undefined
}

const RETRIABLE_ERRORS: Partial<Record<string, SendErrorKey>> = {
	AI_UNAVAILABLE: 'errors.api.AI_UNAVAILABLE',
	// the per-minute throttler: a minute later the same message is fine
	TOO_MANY_REQUESTS: 'errors.api.TOO_MANY_REQUESTS',
	MESSAGE_IN_PROGRESS: 'errors.api.MESSAGE_IN_PROGRESS',
	// the photo storage is down for now; the photo stays in the bubble, a later try may work
	STORAGE_UNAVAILABLE: 'errors.api.STORAGE_UNAVAILABLE',
	// another tab changed the entry the message was about; the resend sees the new day
	ENTRY_CHANGED: 'errors.api.ENTRY_CHANGED',
	// the entry to copy («як учора») was deleted a moment ago; the resend sees the day as it is now
	TURN_COPY_SOURCE_MISSING: 'errors.api.TURN_COPY_SOURCE_MISSING',
}

/** What Kusik's «ой» bubble says under a message that didn't go through. */
export const getSendError = (error: ApiError): SendError => {
	if (error.kind === 'network') return { messageKey: 'chat.networkError', canRetry: true }
	if (error.kind === 'unknown') return { messageKey: 'errors.api.UNKNOWN', canRetry: true }

	if (error.errorCode === VALIDATION_ERROR_CODE) {
		const photoError = getPhotoFieldError(error.details)
		if (photoError) return { messageKey: photoError, canRetry: false }
	}
	const final = FINAL_ERRORS[error.errorCode]
	if (final) return { messageKey: final, canRetry: false }
	const retriable = RETRIABLE_ERRORS[error.errorCode]
	if (retriable) return { messageKey: retriable, canRetry: true }
	if (error.status >= HTTP_STATUS.serverErrorMin) {
		return { messageKey: 'errors.api.SERVER', canRetry: true }
	}
	return { messageKey: 'errors.api.UNKNOWN', canRetry: true }
}

/** The photo of a failed message was only in memory: the text came back, the picture did not. */
export const PHOTO_LOST_FAILURE: SendError = { messageKey: 'chat.photoLost', canRetry: false }

/** Offline: the photo is too heavy to queue, so it waits for a connection to be sent again. */
export const PHOTO_NEEDS_NETWORK_FAILURE: SendError = {
	messageKey: 'chat.photoNeedsNetwork',
	canRetry: true,
}

/** A draft brought back from storage after a reload: the reason wasn't kept, a resend may work. */
export const RESTORED_FAILURE: SendError = { messageKey: 'errors.api.UNKNOWN', canRetry: true }

/** A message the server marked FAILED (seen after a reload): the reason is gone, a resend may work. */
export const STORED_FAILURE: SendError = { messageKey: 'errors.api.AI_UNAVAILABLE', canRetry: true }
