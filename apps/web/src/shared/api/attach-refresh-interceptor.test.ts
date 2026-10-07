import axios, { type AxiosInstance } from 'axios'
import { describe, expect, it, vi } from 'vitest'

import { apiErrorBody, createFakeAdapter, type FakeReply } from '@/shared/testing'

import { getApiError } from './api-error'
import { attachRefreshInterceptor } from './attach-refresh-interceptor'

const UNAUTHORIZED: FakeReply = { status: 401, data: apiErrorBody(401, 'UNAUTHORIZED') }
const REFRESH_DEAD: FakeReply = { status: 401, data: apiErrorBody(401, 'REFRESH_TOKEN_INVALID') }
const OK: FakeReply = { status: 200, data: { data: 'ok' } }
const NO_CONTENT: FakeReply = { status: 204 }

interface SetupOptions {
	/** What /auth/refresh answers. */
	refreshReply: FakeReply
	/** Whether a request with a «fresh» access cookie succeeds after the refresh. */
	isAccessValidAfterRefresh?: boolean
}

/** A fake API where every request is 401 until /auth/refresh succeeds. */
const setup = ({ refreshReply, isAccessValidAfterRefresh = true }: SetupOptions) => {
	let isAccessValid = false
	const fake = createFakeAdapter(async ({ url }) => {
		if (url === '/auth/refresh') {
			// let the other parallel 401s arrive while the refresh is still in flight
			await new Promise((resolve) => setTimeout(resolve, 5))
			if (refreshReply !== 'network' && refreshReply.status < 300) {
				isAccessValid = isAccessValidAfterRefresh
			}
			return refreshReply
		}
		if (url === '/auth/login') return UNAUTHORIZED
		return isAccessValid ? OK : UNAUTHORIZED
	})
	const client: AxiosInstance = axios.create({ adapter: fake.adapter })
	const onRefreshFailed = vi.fn()
	attachRefreshInterceptor(client, {
		refresh: async () => {
			await client.post('/auth/refresh')
		},
		onRefreshFailed,
	})
	return { client, fake, onRefreshFailed }
}

describe('attachRefreshInterceptor', () => {
	it('refreshes once on a 401 and replays the request', async () => {
		const { client, fake, onRefreshFailed } = setup({ refreshReply: NO_CONTENT })

		const response = await client.get('/users/me')

		expect(response.data).toEqual({ data: 'ok' })
		expect(fake.calls).toEqual(['/users/me', '/auth/refresh', '/users/me'])
		expect(onRefreshFailed).not.toHaveBeenCalled()
	})

	it('shares one refresh between parallel 401s and replays each of them', async () => {
		const { client, fake } = setup({ refreshReply: NO_CONTENT })

		const responses = await Promise.all([
			client.get('/users/me'),
			client.get('/entries'),
			client.get('/stats'),
		])

		expect(responses.map((response) => response.status)).toEqual([200, 200, 200])
		expect(fake.countCalls('/auth/refresh')).toBe(1)
		expect(fake.countCalls('/users/me')).toBe(2)
		expect(fake.countCalls('/entries')).toBe(2)
		expect(fake.countCalls('/stats')).toBe(2)
	})

	it('ends the session once when the refresh token is dead and rejects every waiter with 401', async () => {
		const { client, fake, onRefreshFailed } = setup({ refreshReply: REFRESH_DEAD })

		const results = await Promise.allSettled([client.get('/users/me'), client.get('/entries')])

		expect(fake.countCalls('/auth/refresh')).toBe(1)
		expect(onRefreshFailed).toHaveBeenCalledTimes(1)
		for (const result of results) {
			expect(result.status).toBe('rejected')
			if (result.status === 'rejected') {
				expect(getApiError(result.reason)).toMatchObject({ status: 401, errorCode: 'UNAUTHORIZED' })
			}
		}
	})

	it('ends the session when the refresh answers another 4xx (a proxy 403)', async () => {
		const { client, onRefreshFailed } = setup({
			refreshReply: { status: 403, data: apiErrorBody(403, 'FORBIDDEN') },
		})

		const error: unknown = await client.get('/users/me').catch((reason: unknown) => reason)

		expect(onRefreshFailed).toHaveBeenCalledTimes(1)
		expect(getApiError(error)).toMatchObject({ status: 401 })
	})

	it('keeps the session when the refresh itself is throttled (429)', async () => {
		const { client, onRefreshFailed } = setup({
			refreshReply: { status: 429, data: apiErrorBody(429, 'TOO_MANY_REQUESTS') },
		})

		await expect(client.get('/users/me')).rejects.toThrow()

		expect(onRefreshFailed).not.toHaveBeenCalled()
	})

	it('keeps the session when the refresh fails on the network', async () => {
		const { client, onRefreshFailed } = setup({ refreshReply: 'network' })

		const error: unknown = await client.get('/users/me').catch((reason: unknown) => reason)

		expect(getApiError(error)).toEqual({ kind: 'network' })
		expect(onRefreshFailed).not.toHaveBeenCalled()
	})

	it('never refreshes for a 401 from login', async () => {
		const { client, fake } = setup({ refreshReply: NO_CONTENT })

		await expect(client.post('/auth/login')).rejects.toThrow()

		expect(fake.calls).toEqual(['/auth/login'])
	})

	it('does not loop when the replayed request is 401 again', async () => {
		const { client, fake, onRefreshFailed } = setup({
			refreshReply: NO_CONTENT,
			isAccessValidAfterRefresh: false,
		})

		await expect(client.get('/users/me')).rejects.toThrow()

		expect(fake.calls).toEqual(['/users/me', '/auth/refresh', '/users/me'])
		expect(onRefreshFailed).not.toHaveBeenCalled()
	})

	it('starts a new refresh for a later wave of 401s', async () => {
		const { client, fake } = setup({ refreshReply: NO_CONTENT, isAccessValidAfterRefresh: false })

		await client.get('/users/me').catch(() => undefined)
		await client.get('/users/me').catch(() => undefined)

		expect(fake.countCalls('/auth/refresh')).toBe(2)
	})
})
