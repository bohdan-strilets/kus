import type { AuthUser } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { endSession, SESSION_QUERY_KEY, setSessionUser } from './session-query'

const user: AuthUser = {
	id: '0199a000-0000-7000-8000-000000000002',
	email: 'next@kus.app',
	name: 'Next',
	addressAs: null,
	locale: 'uk',
	timezone: 'Europe/Warsaw',
	createdAt: '2026-10-01T00:00:00.000Z',
	pendingDeletion: false,
	purgeAt: null,
}

const ENTRIES_KEY = ['entries', '2026-10-07']

describe('session cache', () => {
	it('a new login drops whatever the previous user left in the cache', () => {
		const queryClient = new QueryClient()
		queryClient.setQueryData(SESSION_QUERY_KEY, null)
		queryClient.setQueryData(ENTRIES_KEY, ['previous user data'])

		setSessionUser(queryClient, user)

		expect(queryClient.getQueryData(ENTRIES_KEY)).toBeUndefined()
		expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toEqual(user)
	})

	it('ending the session keeps an explicit anonymous entry', () => {
		const queryClient = new QueryClient()
		queryClient.setQueryData(SESSION_QUERY_KEY, user)
		queryClient.setQueryData(ENTRIES_KEY, ['private'])

		endSession(queryClient)

		expect(queryClient.getQueryData(ENTRIES_KEY)).toBeUndefined()
		expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull()
	})
})
