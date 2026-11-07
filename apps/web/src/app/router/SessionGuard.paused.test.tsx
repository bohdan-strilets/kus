// @vitest-environment jsdom
import type { AuthUser } from '@kus/shared'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_QUERY_KEY } from '@/entities/session'
import { useLiveWorkoutStore } from '@/features/live-workout'
import { httpClient } from '@/shared/api'
import { TRAINING_LIVE_ROUTE } from '@/shared/config'
import { i18n } from '@/shared/i18n'
import { makeLiveResponse, stubMatchMedia } from '@/shared/testing'
import { ToastProvider } from '@/shared/ui'

import { getRouteGuardDecision } from './get-route-guard-decision'
import { SessionGuard } from './SessionGuard'

const OWNER = '0199b3a4-0000-7000-8000-00000000000a'
const OTHER_OWNER = '0199b3a4-0000-7000-8000-00000000000b'
const RETRY = 'Спробувати ще раз'

const getMock = vi.spyOn(httpClient, 'get')

const makeUser = (): AuthUser => ({
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
})

const renderGuard = (path: string, queryClient = new QueryClient()) => {
	stubMatchMedia()
	const router = createMemoryRouter(
		[
			{
				element: <SessionGuard guard="guest" />,
				children: [{ path: 'login', element: <p>LOGIN FORM</p> }],
			},
			{
				element: <SessionGuard guard="protected" />,
				children: [
					{ path: 'app/training/live', element: <p>LIVE SCREEN</p> },
					{ path: 'app', element: <p>CHAT</p> },
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

beforeEach(() => {
	useLiveWorkoutStore.setState({ ownerId: null, snapshots: {}, lastSeen: null })
})

afterEach(() => {
	onlineManager.setOnline(true)
	cleanup()
	vi.clearAllMocks()
})

describe('live store: lastSeen of another owner', () => {
	it('claim(otherUserId) leaves nothing for the offline live screen', () => {
		useLiveWorkoutStore.setState({ ownerId: OWNER, lastSeen: makeLiveResponse() })

		useLiveWorkoutStore.getState().claim(OTHER_OWNER)

		const { ownerId, lastSeen } = useLiveWorkoutStore.getState()
		const hasOfflineLive = ownerId !== null && lastSeen !== null
		expect(hasOfflineLive).toBe(false)
		expect(
			getRouteGuardDecision({
				guard: 'protected',
				status: 'pending',
				hasOfflineLive,
				path: TRAINING_LIVE_ROUTE,
				locationState: null,
				isPendingDeletion: false,
			}),
		).toEqual({ action: 'loading' })
	})

	it('the live route does not render the previous owner copy while the check hangs', async () => {
		getMock.mockReturnValue(new Promise(() => undefined))
		useLiveWorkoutStore.setState({ ownerId: OWNER, lastSeen: makeLiveResponse() })
		useLiveWorkoutStore.getState().claim(OTHER_OWNER)
		renderGuard(TRAINING_LIVE_ROUTE)

		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(screen.queryByText('LIVE SCREEN')).toBeNull()
	})
})

describe('SessionGuard: the session check is paused (offline)', () => {
	it('guest route renders the form, no loader, no retry screen', async () => {
		onlineManager.setOnline(false)
		renderGuard('/login')

		expect(await screen.findByText('LOGIN FORM')).toBeTruthy()
		expect(screen.queryByRole('button', { name: RETRY })).toBeNull()
		expect(getMock).not.toHaveBeenCalled()
	})

	it('guest route still sends an authenticated user away from the form', async () => {
		onlineManager.setOnline(false)
		const queryClient = new QueryClient()
		queryClient.setQueryData(SESSION_QUERY_KEY, makeUser())
		const router = renderGuard('/login', queryClient)

		expect(await screen.findByText('CHAT')).toBeTruthy()
		expect(screen.queryByText('LOGIN FORM')).toBeNull()
		expect(router.state.location.pathname).not.toBe('/login')
	})

	it('live route without lastSeen shows «retry», not an endless loader or the live screen', async () => {
		onlineManager.setOnline(false)
		renderGuard(TRAINING_LIVE_ROUTE)

		expect(await screen.findByRole('button', { name: RETRY })).toBeTruthy()
		expect(screen.queryByText('LIVE SCREEN')).toBeNull()
	})
})
