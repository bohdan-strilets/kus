import type { AuthUser } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { getSessionStatus } from './get-session-status'

const user: AuthUser = {
	id: '0199a000-0000-7000-8000-000000000001',
	email: 'me@kus.app',
	name: 'Me',
	locale: 'uk',
	timezone: 'Europe/Warsaw',
	createdAt: '2026-10-01T00:00:00.000Z',
}

describe('getSessionStatus', () => {
	it('is pending before the first answer', () => {
		expect(getSessionStatus({ data: undefined, isPending: true, isError: false })).toBe('pending')
	})

	it('is authenticated with a user, even if a refetch failed later', () => {
		expect(getSessionStatus({ data: user, isPending: false, isError: true })).toBe('authenticated')
	})

	it('is anonymous when /users/me answered 401 (null)', () => {
		expect(getSessionStatus({ data: null, isPending: false, isError: false })).toBe('anonymous')
	})

	it('is error when the check itself failed (network, 5xx)', () => {
		expect(getSessionStatus({ data: undefined, isPending: false, isError: true })).toBe('error')
	})
})
