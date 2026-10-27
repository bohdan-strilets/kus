// @vitest-environment jsdom
import type { AuthUser } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ROUTES } from '@/shared/config'
import { resetRevealedValues, revokeSessionObjectUrls } from '@/shared/lib'
import { renderHookWithProviders } from '@/shared/testing'

import { SESSION_QUERY_KEY, setSessionUser } from './session-query'
import { useLeaveSession } from './use-leave-session'

vi.mock('@/shared/lib', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	resetRevealedValues: vi.fn(),
	revokeSessionObjectUrls: vi.fn(),
}))

const user: AuthUser = {
	id: '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
	email: 'me@kus.app',
	name: null,
	addressAs: null,
	addressForm: 'NEUTRAL',
	locale: 'uk',
	timezone: 'Europe/Warsaw',
	createdAt: '2026-10-01T08:00:00.000Z',
	pendingDeletion: false,
	purgeAt: null,
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('useLeaveSession', () => {
	it('forgets the shown ring and bar values, ends the session and goes to /login', async () => {
		const queryClient = new QueryClient()
		setSessionUser(queryClient, user)
		const paths: string[] = []
		const { result } = renderHookWithProviders(() => useLeaveSession(), {
			queryClient,
			route: ROUTES.chat,
			onPathname: (pathname) => paths.push(pathname),
		})

		act(() => {
			result.current.leave()
		})

		expect(resetRevealedValues).toHaveBeenCalledTimes(1)
		expect(revokeSessionObjectUrls).toHaveBeenCalledTimes(1)
		expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull()
		await waitFor(() => {
			expect(paths.at(-1)).toBe(ROUTES.login)
		})
	})
})
