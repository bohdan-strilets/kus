import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import { formatTime } from '@/shared/lib'

import { getDeleteAccountError } from './get-delete-account-error'

const httpError = (statusCode: number, errorCode: string, details: Record<string, unknown> = {}) =>
	new AxiosError('failed', AxiosError.ERR_BAD_RESPONSE, undefined, undefined, {
		status: statusCode,
		statusText: '',
		data: { statusCode, errorCode, details },
		headers: {},
		config: { headers: new AxiosHeaders() },
	})

describe('getDeleteAccountError', () => {
	it('a wrong password', () => {
		expect(getDeleteAccountError(httpError(400, 'PASSWORD_INCORRECT'))).toEqual({
			key: 'errors.api.PASSWORD_INCORRECT',
		})
	})

	it('a lockout with the unlock time', () => {
		const lockedUntil = '2026-10-07T12:35:00.000Z'

		expect(getDeleteAccountError(httpError(423, 'ACCOUNT_LOCKED', { lockedUntil }))).toEqual({
			key: 'errors.api.ACCOUNT_LOCKED',
			params: { time: formatTime(new Date(lockedUntil)) },
		})
	})

	it('429, network, 5xx and the rest', () => {
		expect(getDeleteAccountError(httpError(429, 'THROTTLED'))).toEqual({
			key: 'errors.api.TOO_MANY_REQUESTS',
		})
		expect(getDeleteAccountError(new AxiosError('Network Error', AxiosError.ERR_NETWORK))).toEqual({
			key: 'errors.api.NETWORK',
		})
		expect(getDeleteAccountError(httpError(500, 'INTERNAL'))).toEqual({ key: 'errors.api.SERVER' })
		expect(getDeleteAccountError(httpError(404, 'NOPE'))).toEqual({ key: 'errors.api.UNKNOWN' })
		expect(getDeleteAccountError(new Error('x'))).toEqual({ key: 'errors.api.UNKNOWN' })
	})
})
