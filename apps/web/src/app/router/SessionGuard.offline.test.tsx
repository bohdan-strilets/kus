// @vitest-environment jsdom
import type { AuthUser } from '@kus/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError, AxiosHeaders } from 'axios'
import { I18nextProvider } from 'react-i18next'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLiveWorkoutStore } from '@/features/live-workout'
import { httpClient } from '@/shared/api'
import { SESSION_QUERY_KEY } from '@/entities/session'
import { ROUTES, TRAINING_LIVE_ROUTE } from '@/shared/config'
import { i18n } from '@/shared/i18n'
import { makeLiveResponse, stubMatchMedia } from '@/shared/testing'
import { ToastProvider } from '@/shared/ui'

import { SessionErrorState } from './SessionErrorState'
import { SessionGuard } from './SessionGuard'

const OWNER = '0199b3a4-0000-7000-8000-00000000000a'
const RESUME = 'Продовжити тренування'
const RETRY = 'Повторити'
// the session check retries once with the default 1 s backoff before it gives up
const RETRY_WAIT_MS = 5000

const getMock = vi.spyOn(httpClient, 'get')

const failWith = (error: AxiosError): void => {
	getMock.mockRejectedValue(error)
}

const renderGuard = (path: string, queryClient: QueryClient = new QueryClient()) => {
	stubMatchMedia()
	const router = createMemoryRouter(
		[
			{
				path: '/app',
				element: <SessionGuard guard="protected" />,
				children: [
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

beforeEach(() => {
	useLiveWorkoutStore.setState({ ownerId: null, snapshots: {}, lastSeen: null })
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('SessionErrorState', () => {
	it('shows only «retry» without onResumeLive', () => {
		stubMatchMedia()
		render(
			<I18nextProvider i18n={i18n}>
				<SessionErrorState onRetry={vi.fn()} />
			</I18nextProvider>,
		)

		expect(screen.getByRole('button', { name: RETRY })).toBeTruthy()
		expect(screen.queryByRole('button', { name: RESUME })).toBeNull()
	})

	it('shows «Продовжити тренування» that calls onResumeLive', () => {
		stubMatchMedia()
		const onResumeLive = vi.fn()
		render(
			<I18nextProvider i18n={i18n}>
				<SessionErrorState onRetry={vi.fn()} onResumeLive={onResumeLive} />
			</I18nextProvider>,
		)

		fireEvent.click(screen.getByRole('button', { name: RESUME }))

		expect(onResumeLive).toHaveBeenCalledTimes(1)
	})
})

describe('SessionGuard: offline with a kept live workout', () => {
	it('offers «Продовжити тренування» on another route and it leads to the live screen', async () => {
		failWith(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
		useLiveWorkoutStore.setState({ ownerId: OWNER, lastSeen: makeLiveResponse() })
		const router = renderGuard('/app/today')

		fireEvent.click(await screen.findByRole('button', { name: RESUME }, { timeout: RETRY_WAIT_MS }))

		await waitFor(() => {
			expect(router.state.location.pathname).toBe(TRAINING_LIVE_ROUTE)
		})
		expect(await screen.findByText('LIVE SCREEN')).toBeTruthy()
	})

	it('renders the live route itself without the error screen', async () => {
		failWith(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
		useLiveWorkoutStore.setState({ ownerId: OWNER, lastSeen: makeLiveResponse() })
		renderGuard(TRAINING_LIVE_ROUTE)

		expect(await screen.findByText('LIVE SCREEN', {}, { timeout: RETRY_WAIT_MS })).toBeTruthy()
	})

	it('has no resume button without a kept session, and the live route stays on «retry»', async () => {
		failWith(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
		renderGuard(TRAINING_LIVE_ROUTE)

		expect(
			await screen.findByRole('button', { name: RETRY }, { timeout: RETRY_WAIT_MS }),
		).toBeTruthy()
		expect(screen.queryByRole('button', { name: RESUME })).toBeNull()
		expect(screen.queryByText('LIVE SCREEN')).toBeNull()
	})

	it('has no resume button when lastSeen exists but nobody owns it', async () => {
		failWith(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
		useLiveWorkoutStore.setState({ ownerId: null, lastSeen: makeLiveResponse() })
		renderGuard('/app/today')

		expect(
			await screen.findByRole('button', { name: RETRY }, { timeout: RETRY_WAIT_MS }),
		).toBeTruthy()
		expect(screen.queryByRole('button', { name: RESUME })).toBeNull()
	})

	it('does not open the live screen when the API answered with a 500', async () => {
		const config = { headers: new AxiosHeaders() }
		failWith(
			new AxiosError('failed', AxiosError.ERR_BAD_RESPONSE, config, null, {
				status: 500,
				statusText: '500',
				headers: {},
				config,
				data: { statusCode: 500, errorCode: 'INTERNAL_ERROR', details: {} },
			}),
		)
		useLiveWorkoutStore.setState({ ownerId: OWNER, lastSeen: makeLiveResponse() })
		renderGuard(TRAINING_LIVE_ROUTE)

		expect(
			await screen.findByRole('button', { name: RETRY }, { timeout: RETRY_WAIT_MS }),
		).toBeTruthy()
		expect(screen.queryByText('LIVE SCREEN')).toBeNull()
		expect(screen.queryByRole('button', { name: RESUME })).toBeNull()
	})

	// Offline with no cached user the account state is unknown (the session cache is in memory only),
	// so the offline branch can't check it; a cached pending-deletion user never reaches that branch.
	it('sends a pending-deletion account to account-restore, not the live screen, offline', async () => {
		failWith(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
		useLiveWorkoutStore.setState({ ownerId: OWNER, lastSeen: makeLiveResponse() })
		const queryClient = new QueryClient()
		const user: AuthUser = {
			id: OWNER,
			email: 'me@kus.app',
			name: 'Me',
			addressAs: null,
			addressForm: 'NEUTRAL',
			locale: 'uk',
			timezone: 'Europe/Warsaw',
			createdAt: '2026-10-01T00:00:00.000Z',
			pendingDeletion: true,
			purgeAt: null,
		}
		queryClient.setQueryData(SESSION_QUERY_KEY, user)
		const router = renderGuard(TRAINING_LIVE_ROUTE, queryClient)

		await waitFor(() => {
			expect(router.state.location.pathname).toBe(ROUTES.accountRestore)
		})
		expect(screen.queryByText('LIVE SCREEN')).toBeNull()
	})
})
