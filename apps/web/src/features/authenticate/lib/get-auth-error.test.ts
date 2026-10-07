import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import { formatTime } from '@/shared/lib'

import { getAuthError } from './get-auth-error'

const httpError = (statusCode: number, errorCode: string, details: Record<string, unknown> = {}) =>
	new AxiosError('failed', AxiosError.ERR_BAD_RESPONSE, undefined, undefined, {
		status: statusCode,
		statusText: '',
		data: { statusCode, errorCode, details },
		headers: {},
		config: { headers: new AxiosHeaders() },
	})

describe('getAuthError', () => {
	it('wrong credentials go under the password field', () => {
		expect(getAuthError(httpError(401, 'INVALID_CREDENTIALS'))).toEqual({
			fields: { password: { key: 'errors.api.INVALID_CREDENTIALS' } },
		})
	})

	it('a taken email goes under the email field', () => {
		expect(getAuthError(httpError(409, 'EMAIL_TAKEN'))).toEqual({
			fields: { email: { key: 'errors.api.EMAIL_TAKEN' } },
		})
	})

	it('a lockout goes to the alert line with the unlock time', () => {
		const lockedUntil = '2026-10-07T12:35:00.000Z'

		expect(getAuthError(httpError(423, 'ACCOUNT_LOCKED', { lockedUntil }))).toEqual({
			fields: {},
			form: {
				key: 'errors.api.ACCOUNT_LOCKED',
				params: { time: formatTime(new Date(lockedUntil)) },
			},
		})
	})

	it('a lockout without a time still explains itself', () => {
		expect(getAuthError(httpError(423, 'ACCOUNT_LOCKED')).form).toEqual({
			key: 'errors.api.ACCOUNT_LOCKED_NO_TIME',
		})
		expect(
			getAuthError(httpError(423, 'ACCOUNT_LOCKED', { lockedUntil: 'not-a-date' })).form,
		).toEqual({ key: 'errors.api.ACCOUNT_LOCKED_NO_TIME' })
	})

	it.each([
		['throttled', httpError(429, 'TOO_MANY_REQUESTS'), 'errors.api.TOO_MANY_REQUESTS'],
		[
			'registration closed',
			httpError(403, 'REGISTRATION_DISABLED'),
			'errors.api.REGISTRATION_DISABLED',
		],
		['a server error', httpError(500, 'INTERNAL_ERROR'), 'errors.api.SERVER'],
		['an unexpected 4xx', httpError(405, 'CLIENT_ERROR'), 'errors.api.UNKNOWN'],
		['no answer', new AxiosError('Network Error', AxiosError.ERR_NETWORK), 'errors.api.NETWORK'],
		['not an HTTP error', new Error('bug'), 'errors.api.UNKNOWN'],
	])('%s goes to the alert line, fields stay neutral', (_case, error, key) => {
		expect(getAuthError(error)).toEqual({ fields: {}, form: { key } })
	})

	it('server validation goes under each known field', () => {
		const error = httpError(422, 'VALIDATION_ERROR', {
			fields: { email: 'INVALID_FORMAT', password: 'TOO_SMALL', consent: 'INVALID_VALUE' },
		})

		expect(getAuthError(error)).toEqual({
			fields: {
				email: { key: 'errors.validation.INVALID_FORMAT' },
				password: { key: 'errors.validation.TOO_SMALL' },
				consent: { key: 'errors.validation.INVALID_VALUE' },
			},
		})
	})

	it('server validation of unknown fields falls back to the alert line', () => {
		const error = httpError(422, 'VALIDATION_ERROR', { fields: { _root: 'UNKNOWN_FIELD' } })

		expect(getAuthError(error)).toEqual({ fields: {}, form: { key: 'errors.api.UNKNOWN' } })
	})
})
