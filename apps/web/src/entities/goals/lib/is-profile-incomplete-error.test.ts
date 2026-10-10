import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { isProfileIncompleteError } from './is-profile-incomplete-error'

const makeError = (status: number, errorCode: string): AxiosError => {
	// only status and data are read; the rest of AxiosResponse is irrelevant here
	const response = { status, data: { statusCode: status, errorCode, details: {} } } as AxiosResponse
	return new AxiosError('failed', undefined, undefined, undefined, response)
}

describe('isProfileIncompleteError', () => {
	it('recognises 409 PROFILE_INCOMPLETE', () => {
		expect(isProfileIncompleteError(makeError(409, 'PROFILE_INCOMPLETE'))).toBe(true)
	})

	it('ignores other conflicts, other statuses and non-HTTP errors', () => {
		expect(isProfileIncompleteError(makeError(409, 'EMAIL_TAKEN'))).toBe(false)
		expect(isProfileIncompleteError(makeError(500, 'PROFILE_INCOMPLETE'))).toBe(false)
		expect(isProfileIncompleteError(new Error('boom'))).toBe(false)
		expect(isProfileIncompleteError(null)).toBe(false)
	})
})
