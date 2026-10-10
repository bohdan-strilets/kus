import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SESSION_QUERY_KEY, sessionQueryOptions } from '@/entities/session'
import { httpClient } from '@/shared/api'
import { apiErrorBody, createFakeAdapter, type FakeHandler } from '@/shared/testing'

import { setupSession } from './setup-session'

const user = {
	id: '0199a000-0000-7000-8000-000000000001',
	email: 'me@kus.app',
	name: 'Me',
	addressAs: null,
	locale: 'uk',
	timezone: 'Europe/Warsaw',
	createdAt: '2026-10-01T00:00:00.000Z',
	pendingDeletion: false,
	purgeAt: null,
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('setupSession', () => {
	let queryClient: QueryClient
	let detach: () => void
	const originalAdapter = httpClient.defaults.adapter

	const useFakeApi = (handler: FakeHandler) => {
		const fake = createFakeAdapter(handler)
		httpClient.defaults.adapter = fake.adapter
		return fake
	}

	beforeEach(() => {
		queryClient = new QueryClient()
		detach = setupSession({ client: httpClient, queryClient })
	})

	afterEach(() => {
		detach()
		queryClient.clear()
		httpClient.defaults.adapter = originalAdapter
	})

	it('anonymous on /login: exactly one /users/me and one refresh, no loop', async () => {
		const fake = useFakeApi(({ url }) =>
			url === '/auth/refresh'
				? { status: 401, data: apiErrorBody(401, 'REFRESH_TOKEN_INVALID') }
				: { status: 401, data: apiErrorBody(401, 'UNAUTHORIZED') },
		)
		// a mounted guard: it would refetch if the session entry were cleared or invalidated
		const observer = new QueryObserver(queryClient, sessionQueryOptions)
		const unsubscribe = observer.subscribe(() => undefined)

		await settle()

		expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull()
		expect(fake.calls).toEqual(['/users/me', '/auth/refresh'])
		unsubscribe()
	})

	it('a live session: the expired access is refreshed silently and the user stays', async () => {
		let isAccessValid = false
		const fake = useFakeApi(({ url }) => {
			if (url === '/auth/refresh') {
				isAccessValid = true
				return { status: 204 }
			}
			return isAccessValid
				? { status: 200, data: { data: user } }
				: { status: 401, data: apiErrorBody(401, 'UNAUTHORIZED') }
		})

		const me = await queryClient.query(sessionQueryOptions)

		expect(me?.email).toBe(user.email)
		expect(fake.calls).toEqual(['/users/me', '/auth/refresh', '/users/me'])
	})

	it('a dead refresh drops other cached data but keeps the session as anonymous', async () => {
		queryClient.setQueryData(SESSION_QUERY_KEY, user)
		queryClient.setQueryData(['entries', '2026-10-07'], ['private'])
		useFakeApi(({ url }) =>
			url === '/auth/refresh'
				? { status: 401, data: apiErrorBody(401, 'REFRESH_TOKEN_REUSED') }
				: { status: 401, data: apiErrorBody(401, 'UNAUTHORIZED') },
		)

		await expect(httpClient.get('/entries')).rejects.toThrow()

		expect(queryClient.getQueryData(['entries', '2026-10-07'])).toBeUndefined()
		expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull()
	})

	it('a network failure on refresh keeps the user logged in', async () => {
		queryClient.setQueryData(SESSION_QUERY_KEY, user)
		useFakeApi(({ url }) =>
			url === '/auth/refresh'
				? 'network'
				: { status: 401, data: apiErrorBody(401, 'UNAUTHORIZED') },
		)

		await expect(httpClient.get('/entries')).rejects.toThrow()

		expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toEqual(user)
	})
})
