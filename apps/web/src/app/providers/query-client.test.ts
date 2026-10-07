import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { shouldRetry } from './query-client'

const createHttpError = (status: number): AxiosError =>
	new AxiosError('request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
		status,
		statusText: '',
		data: null,
		headers: {},
		config: { headers: new AxiosHeaders() },
	})

describe('shouldRetry', () => {
	it('retries network errors and timeouts (no response)', () => {
		expect(shouldRetry(0, new AxiosError('timeout', 'ECONNABORTED'))).toBe(true)
	})

	it('retries 5xx', () => {
		expect(shouldRetry(0, createHttpError(503))).toBe(true)
	})

	it('does not retry 4xx', () => {
		expect(shouldRetry(0, createHttpError(404))).toBe(false)
	})

	it('does not retry a broken response contract', () => {
		const contractError = z.object({ status: z.literal('ok') }).safeParse({}).error
		expect(shouldRetry(0, contractError)).toBe(false)
	})

	it('stops after the retry limit', () => {
		expect(shouldRetry(2, createHttpError(503))).toBe(false)
	})
})
