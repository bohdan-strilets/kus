import { describe, expect, it } from 'vitest'

import { getSendError } from './get-send-error'

const http = (status: number, errorCode: string) =>
	({ kind: 'http', status, errorCode, details: {} }) as const

describe('getSendError', () => {
	it('offers a retry after a lost connection, with the chat-error text', () => {
		expect(getSendError({ kind: 'network' })).toEqual({
			messageKey: 'chat.networkError',
			canRetry: true,
		})
	})

	it('offers a retry when the model failed (503)', () => {
		expect(getSendError(http(503, 'AI_UNAVAILABLE'))).toEqual({
			messageKey: 'errors.api.AI_UNAVAILABLE',
			canRetry: true,
		})
	})

	it('offers no retry for a message that is too long or after the daily limit', () => {
		expect(getSendError(http(422, 'MESSAGE_TOO_LONG')).canRetry).toBe(false)
		expect(getSendError(http(429, 'DAILY_LIMIT_REACHED'))).toEqual({
			messageKey: 'errors.api.DAILY_LIMIT_REACHED',
			canRetry: false,
		})
	})

	it('tells the per-minute throttler apart from the daily limit', () => {
		expect(getSendError(http(429, 'TOO_MANY_REQUESTS'))).toEqual({
			messageKey: 'errors.api.TOO_MANY_REQUESTS',
			canRetry: true,
		})
	})

	it('falls back to a generic text for anything else', () => {
		expect(getSendError(http(500, 'INTERNAL_ERROR')).messageKey).toBe('errors.api.SERVER')
		expect(getSendError(http(422, 'VALIDATION_ERROR')).messageKey).toBe('errors.api.UNKNOWN')
		expect(getSendError({ kind: 'unknown' }).messageKey).toBe('errors.api.UNKNOWN')
	})
})
