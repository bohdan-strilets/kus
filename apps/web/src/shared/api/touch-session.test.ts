import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiErrorBody, createFakeAdapter, type FakeReply } from '@/shared/testing'

import { attachRefreshInterceptor } from './attach-refresh-interceptor'
import { httpClient } from './http-client'
import { touchSession } from './touch-session'

const UNAUTHORIZED: FakeReply = { status: 401, data: apiErrorBody(401, 'UNAUTHORIZED') }
const REFRESH_DEAD: FakeReply = { status: 401, data: apiErrorBody(401, 'REFRESH_TOKEN_INVALID') }
const OK: FakeReply = { status: 200, data: { data: { id: 'user' } } }

const originalAdapter = httpClient.defaults.adapter
let detach: (() => void) | null = null
const onRefreshFailed = vi.fn()

/** Wires the shared httpClient to a fake API; the refresh interceptor is the real one. */
const useFakeApi = (refreshReply: FakeReply, isAccessExpired: boolean) => {
	let isAccessValid = !isAccessExpired
	const fake = createFakeAdapter(({ url }) => {
		if (url === '/auth/refresh') {
			if (refreshReply !== 'network' && refreshReply.status < 300) isAccessValid = true
			return refreshReply
		}
		return isAccessValid ? OK : UNAUTHORIZED
	})
	httpClient.defaults.adapter = fake.adapter
	detach = attachRefreshInterceptor(httpClient, {
		refresh: async () => {
			await httpClient.post('/auth/refresh')
		},
		onRefreshFailed,
	})
	return fake
}

beforeEach(() => {
	onRefreshFailed.mockReset()
})

afterEach(() => {
	detach?.()
	detach = null
	httpClient.defaults.adapter = originalAdapter
})

describe('touchSession', () => {
	it('resolves to true when GET /users/me answers 200', async () => {
		const fake = useFakeApi({ status: 204 }, false)

		await expect(touchSession()).resolves.toBe(true)
		expect(fake.calls).toEqual(['/users/me'])
	})

	it('resolves to false, without throwing, on a network error', async () => {
		const fake = createFakeAdapter(() => 'network')
		httpClient.defaults.adapter = fake.adapter

		await expect(touchSession()).resolves.toBe(false)
	})

	it('renews an expired access token through /auth/refresh and replays /users/me', async () => {
		const fake = useFakeApi({ status: 204 }, true)

		await expect(touchSession()).resolves.toBe(true)
		expect(fake.calls).toEqual(['/users/me', '/auth/refresh', '/users/me'])
		expect(onRefreshFailed).not.toHaveBeenCalled()
	})

	it('resolves to false and ends the session when the refresh token is dead', async () => {
		const fake = useFakeApi(REFRESH_DEAD, true)

		await expect(touchSession()).resolves.toBe(false)
		expect(fake.calls).toEqual(['/users/me', '/auth/refresh'])
		expect(onRefreshFailed).toHaveBeenCalledTimes(1)
	})
})
