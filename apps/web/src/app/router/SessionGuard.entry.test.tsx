// @vitest-environment jsdom
import type { AuthUser } from '@kus/shared'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { I18nextProvider } from 'react-i18next'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_QUERY_KEY } from '@/entities/session'
import { useLiveWorkoutStore } from '@/features/live-workout'
import { httpClient } from '@/shared/api'
import { ROUTES, TAB_ROUTES, TRAINING_LIVE_ROUTE } from '@/shared/config'
import { i18n } from '@/shared/i18n'
import { makeLiveResponse, makeWorkout, stubMatchMedia } from '@/shared/testing'
import { ToastProvider } from '@/shared/ui'

import { resetRouteEntry } from './route-entry'
import { SessionGuard } from './SessionGuard'

const OWNER = '0199b3a4-0000-7000-8000-00000000000a'
const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000

const getMock = vi.spyOn(httpClient, 'get')

const makeUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
	id: OWNER,
	email: 'me@kus.app',
	name: 'Me',
	addressAs: null,
	addressForm: 'NEUTRAL',
	locale: 'uk',
	timezone: 'Europe/Warsaw',
	createdAt: '2026-10-01T00:00:00.000Z',
	pendingDeletion: false,
	purgeAt: null,
	...overrides,
})

const liveStartedAgo = (ms: number) =>
	makeLiveResponse({
		workout: makeWorkout({
			source: 'LIVE',
			startedAt: new Date(Date.now() - ms).toISOString(),
			exercises: [],
		}),
	})

const keepLive = (ageMs: number): void => {
	useLiveWorkoutStore.setState({ ownerId: OWNER, lastSeen: liveStartedAgo(ageMs) })
}

const renderApp = (path: string, queryClient: QueryClient = new QueryClient()) => {
	stubMatchMedia()
	const router = createMemoryRouter(
		[
			{
				element: <SessionGuard guard="guest" />,
				children: [{ path: 'login', element: <p>LOGIN FORM</p> }],
			},
			{
				path: '/app',
				element: <SessionGuard guard="protected" />,
				children: [
					{ index: true, element: <p>CHAT</p> },
					{ path: 'today', element: <p>TODAY</p> },
					{ path: 'training/live', element: <p>LIVE SCREEN</p> },
					{ path: 'account-restore', element: <p>RESTORE</p> },
				],
			},
		],
		{ initialEntries: [path] },
	)
	render(
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={queryClient}>
				<ToastProvider>
					<RouterProvider router={router} />
				</ToastProvider>
			</QueryClientProvider>
		</I18nextProvider>,
	)
	return router
}

const signedIn = (user: AuthUser = makeUser()): QueryClient => {
	const queryClient = new QueryClient()
	queryClient.setQueryData(SESSION_QUERY_KEY, user)
	return queryClient
}

beforeEach(() => {
	resetRouteEntry()
	useLiveWorkoutStore.setState({
		ownerId: null,
		pendingDeletion: false,
		snapshots: {},
		lastSeen: null,
	})
	getMock.mockReturnValue(new Promise(() => undefined))
})

afterEach(() => {
	onlineManager.setOnline(true)
	cleanup()
	vi.clearAllMocks()
})

describe('SessionGuard: cold start into a fresh live workout', () => {
	it('lands on the live screen without waiting for /users/me (check still pending)', async () => {
		keepLive(5 * MINUTE_MS)
		const router = renderApp(TAB_ROUTES.chat)

		expect(await screen.findByText('LIVE SCREEN')).toBeTruthy()
		expect(router.state.location.pathname).toBe(TRAINING_LIVE_ROUTE)
	})

	it('lands on the live screen when the session is already known', async () => {
		keepLive(5 * MINUTE_MS)
		const router = renderApp(TAB_ROUTES.today, signedIn())

		expect(await screen.findByText('LIVE SCREEN')).toBeTruthy()
		expect(router.state.location.pathname).toBe(TRAINING_LIVE_ROUTE)
	})

	it('the next navigation (to chat) is not redirected again', async () => {
		keepLive(5 * MINUTE_MS)
		const router = renderApp(TAB_ROUTES.chat, signedIn())
		expect(await screen.findByText('LIVE SCREEN')).toBeTruthy()

		await act(async () => {
			await router.navigate(TAB_ROUTES.chat)
		})

		expect(await screen.findByText('CHAT')).toBeTruthy()
		expect(router.state.location.pathname).toBe(TAB_ROUTES.chat)
	})

	it('a stale copy (over 3 h) does not redirect', async () => {
		keepLive(3 * HOUR_MS + MINUTE_MS)
		const router = renderApp(TAB_ROUTES.chat, signedIn())

		expect(await screen.findByText('CHAT')).toBeTruthy()
		expect(router.state.location.pathname).toBe(TAB_ROUTES.chat)
	})

	it('without an owner nothing is entered', async () => {
		useLiveWorkoutStore.setState({ ownerId: null, lastSeen: liveStartedAgo(MINUTE_MS) })
		const router = renderApp(TAB_ROUTES.chat, signedIn())

		expect(await screen.findByText('CHAT')).toBeTruthy()
		expect(router.state.location.pathname).toBe(TAB_ROUTES.chat)
	})

	it('a login first (guest page) closes the entry: /app/chat afterwards is not redirected', async () => {
		keepLive(5 * MINUTE_MS)
		const router = renderApp(ROUTES.login, signedIn())

		expect(await screen.findByText('CHAT')).toBeTruthy()
		expect(router.state.location.pathname).toBe(TAB_ROUTES.chat)
		expect(screen.queryByText('LIVE SCREEN')).toBeNull()
	})

	it('an offline start (network error) goes to the live screen and stays there', async () => {
		getMock.mockRejectedValue(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
		keepLive(5 * MINUTE_MS)
		const router = renderApp(TAB_ROUTES.chat)

		expect(await screen.findByText('LIVE SCREEN')).toBeTruthy()
		await waitFor(() => {
			expect(router.state.location.pathname).toBe(TRAINING_LIVE_ROUTE)
		})
	})

	it('a pending-deletion session user goes to account-restore, not the workout', async () => {
		keepLive(5 * MINUTE_MS)
		const router = renderApp(TAB_ROUTES.chat, signedIn(makeUser({ pendingDeletion: true })))

		expect(await screen.findByText('RESTORE')).toBeTruthy()
		expect(router.state.location.pathname).toBe(ROUTES.accountRestore)
	})

	it('a remembered pending deletion (store flag) blocks the entry while the check hangs', async () => {
		keepLive(5 * MINUTE_MS)
		useLiveWorkoutStore.setState({ pendingDeletion: true })
		const router = renderApp(TAB_ROUTES.chat)

		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(screen.queryByText('LIVE SCREEN')).toBeNull()
		expect(router.state.location.pathname).not.toBe(TRAINING_LIVE_ROUTE)
	})
})
