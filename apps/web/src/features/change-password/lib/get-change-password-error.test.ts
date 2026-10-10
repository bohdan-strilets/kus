import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import { formatTime } from '@/shared/lib'

import { getChangePasswordError } from './get-change-password-error'

const httpError = (statusCode: number, errorCode: string, details: Record<string, unknown> = {}) =>
	new AxiosError('failed', AxiosError.ERR_BAD_RESPONSE, undefined, undefined, {
		status: statusCode,
		statusText: '',
		data: { statusCode, errorCode, details },
		headers: {},
		config: { headers: new AxiosHeaders() },
	})

describe('getChangePasswordError', () => {
	it('a wrong current password goes under the current password field', () => {
		expect(getChangePasswordError(httpError(400, 'PASSWORD_INCORRECT'))).toEqual({
			fields: { currentPassword: { key: 'errors.api.PASSWORD_INCORRECT' } },
		})
	})

	it('the same password goes under the new password field', () => {
		expect(getChangePasswordError(httpError(400, 'PASSWORD_SAME'))).toEqual({
			fields: { newPassword: { key: 'errors.api.PASSWORD_SAME' } },
		})
	})

	it('a lockout goes under the current password field with the unlock time', () => {
		const lockedUntil = '2026-10-07T12:35:00.000Z'

		expect(getChangePasswordError(httpError(423, 'ACCOUNT_LOCKED', { lockedUntil }))).toEqual({
			fields: {
				currentPassword: {
					key: 'errors.api.ACCOUNT_LOCKED',
					params: { time: formatTime(new Date(lockedUntil)) },
				},
			},
		})
	})

	it('server validation lands under its fields, unknown codes become INVALID_VALUE', () => {
		const error = httpError(422, 'VALIDATION_ERROR', {
			fields: { newPassword: 'TOO_SMALL', currentPassword: 'WEIRD', other: 'REQUIRED' },
		})

		expect(getChangePasswordError(error)).toEqual({
			fields: {
				currentPassword: { key: 'errors.validation.INVALID_VALUE' },
				newPassword: { key: 'errors.validation.TOO_SMALL' },
			},
		})
	})

	it('a validation error without known fields goes to the alert line', () => {
		const error = httpError(422, 'VALIDATION_ERROR', { fields: { other: 'REQUIRED' } })

		expect(getChangePasswordError(error)).toEqual({
			fields: {},
			form: { key: 'errors.api.UNKNOWN' },
		})
	})

	it('429, network, 5xx and the rest go to the alert line', () => {
		const networkError = new AxiosError('Network Error', AxiosError.ERR_NETWORK)

		expect(getChangePasswordError(httpError(429, 'THROTTLED')).form).toEqual({
			key: 'errors.api.TOO_MANY_REQUESTS',
		})
		expect(getChangePasswordError(networkError).form).toEqual({ key: 'errors.api.NETWORK' })
		expect(getChangePasswordError(httpError(500, 'INTERNAL')).form).toEqual({
			key: 'errors.api.SERVER',
		})
		expect(getChangePasswordError(httpError(404, 'NOPE')).form).toEqual({
			key: 'errors.api.UNKNOWN',
		})
		expect(getChangePasswordError(new Error('x')).form).toEqual({ key: 'errors.api.UNKNOWN' })
	})
})
