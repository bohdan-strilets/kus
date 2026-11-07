import { AxiosError, type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'

import { getApiError, httpClient, isRetriableError } from '@/shared/api'

import { putLiveWorkout } from './live-workout'

const originalAdapter = httpClient.defaults.adapter
const LIVE_PUT_TIMEOUT_MS = 10_000
const DEFAULT_TIMEOUT_MS = 15_000

afterEach(() => {
	httpClient.defaults.adapter = originalAdapter
})

const putOnce = async (adapter: AxiosAdapter): Promise<unknown> => {
	httpClient.defaults.adapter = adapter
	try {
		await putLiveWorkout({ workoutId: 'w1', update: { knownEditedAt: null, exercises: [] } })
		return null
	} catch (error) {
		return error
	}
}

describe('putLiveWorkout timeout', () => {
	it('asks for a 10 s timeout, shorter than the default of the client', async () => {
		let seen: number | undefined
		await putOnce((config) => {
			seen = config.timeout
			return Promise.reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config))
		})

		expect(seen).toBe(LIVE_PUT_TIMEOUT_MS)
		expect(httpClient.defaults.timeout).toBe(DEFAULT_TIMEOUT_MS)
	})

	it('reads a timed-out request as a retriable network failure', async () => {
		const error = await putOnce((config) =>
			Promise.reject(
				new AxiosError('timeout of 10000ms exceeded', AxiosError.ECONNABORTED, config),
			),
		)

		expect(getApiError(error)).toEqual({ kind: 'network' })
		expect(isRetriableError(error)).toBe(true)
	})
})
