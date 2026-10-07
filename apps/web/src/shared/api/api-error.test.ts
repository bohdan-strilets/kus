import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import { getApiError } from './api-error'

const responseError = (status: number, data: unknown) =>
	new AxiosError('failed', AxiosError.ERR_BAD_RESPONSE, undefined, undefined, {
		status,
		statusText: '',
		data,
		headers: {},
		config: { headers: new AxiosHeaders() },
	})

describe('getApiError', () => {
	it('reads the API error format', () => {
		const error = responseError(423, {
			statusCode: 423,
			errorCode: 'ACCOUNT_LOCKED',
			details: { lockedUntil: '2026-10-07T12:00:00.000Z' },
		})

		expect(getApiError(error)).toEqual({
			kind: 'http',
			status: 423,
			errorCode: 'ACCOUNT_LOCKED',
			details: { lockedUntil: '2026-10-07T12:00:00.000Z' },
		})
	})

	it('treats no response as a network failure', () => {
		expect(getApiError(new AxiosError('Network Error', AxiosError.ERR_NETWORK))).toEqual({
			kind: 'network',
		})
	})

	it('treats a proxy 5xx without our format as the API being unreachable', () => {
		expect(getApiError(responseError(502, '<html>Bad Gateway</html>'))).toEqual({
			kind: 'network',
		})
		expect(getApiError(responseError(500, ''))).toEqual({ kind: 'network' })
	})

	it('keeps our own 5xx as an http error', () => {
		const error = responseError(500, { statusCode: 500, errorCode: 'INTERNAL_ERROR', details: {} })

		expect(getApiError(error)).toMatchObject({ kind: 'http', status: 500 })
	})

	it('keeps a foreign 4xx as http without a code', () => {
		expect(getApiError(responseError(404, 'Not Found'))).toEqual({
			kind: 'http',
			status: 404,
			errorCode: '',
			details: {},
		})
	})

	it('is unknown for anything that is not a request error', () => {
		expect(getApiError(new Error('bug'))).toEqual({ kind: 'unknown' })
	})
})
