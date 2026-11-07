// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useReducedMotion } from 'motion/react'
import { I18nextProvider } from 'react-i18next'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROUTES, TRAINING_LIVE_ROUTE } from '@/shared/config'
import { i18n } from '@/shared/i18n'
import { makeLiveResponse, stubMatchMedia } from '@/shared/testing'

const mocks = vi.hoisted(() => ({ tabMounts: { count: 0 }, preload: vi.fn() }))

vi.mock('motion/react', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	useReducedMotion: vi.fn(() => false),
}))

vi.mock('./lazy-pages', async () => {
	const { useEffect } = await import('react')
	const { Link: RouterLink } = await import('react-router')
	return {
		preloadTrainingLive: mocks.preload,
		TrainingPage: () => {
			useEffect(() => {
				mocks.tabMounts.count += 1
			}, [])
			return (
				<div data-testid="tab-training">
					<input aria-label="marker" />
					<RouterLink to="/app/training/live">go live</RouterLink>
				</div>
			)
		},
	}
})

vi.mock('@/widgets/bottom-nav', () => ({
	BottomNav: () => <nav aria-label="main nav" />,
	useTodayProgress: () => 0,
}))

let hasLiveWorkout = true
vi.mock('@/widgets/workout-mini-strip', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	useMiniStripLive: () => (hasLiveWorkout ? makeLiveResponse() : null),
	useMiniStripOffline: () => false,
}))

const { RootLayout } = await import('./RootLayout')
const { TrainingPage } = await import('./lazy-pages')

const LiveStub = () => <div data-testid="live-screen">live</div>
const ChatStub = () => (
	<div data-testid="tab-chat">
		<Link to={TRAINING_LIVE_ROUTE}>chat go live</Link>
	</div>
)

const renderApp = (initialPath: string) => {
	stubMatchMedia()
	const router = createMemoryRouter(
		[
			{
				path: ROUTES.chat,
				element: <RootLayout />,
				children: [
					{ index: true, element: <ChatStub /> },
					{ path: ROUTES.training, element: <TrainingPage /> },
					{ path: TRAINING_LIVE_ROUTE, element: <LiveStub /> },
				],
			},
		],
		{ initialEntries: [initialPath] },
	)
	render(
		<I18nextProvider i18n={i18n}>
			<RouterProvider router={router} />
		</I18nextProvider>,
	)
	return router
}

const WAIT = { timeout: 3000 }

beforeEach(() => {
	mocks.tabMounts.count = 0
	hasLiveWorkout = true
	vi.mocked(useReducedMotion).mockReturnValue(false)
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('RootLayout: the live screen over a tab', () => {
	it('opening the live screen from a tab keeps the tab mounted (state survives, no remount)', async () => {
		renderApp(ROUTES.training)
		fireEvent.change(screen.getByLabelText('marker'), { target: { value: 'kept' } })

		fireEvent.click(screen.getByText('go live'))

		await screen.findByTestId('live-screen')
		expect(screen.getByLabelText<HTMLInputElement>('marker').value).toBe('kept')
		expect(mocks.tabMounts.count).toBe(1)
	})

	it('the bottom nav stays in the DOM under the surface', async () => {
		renderApp(ROUTES.training)

		fireEvent.click(screen.getByText('go live'))

		await screen.findByTestId('live-screen')
		expect(screen.getByRole('navigation', { name: 'main nav' })).toBeTruthy()
	})

	it('the tab under the surface is the one the user came from (chat, not training)', async () => {
		renderApp(ROUTES.chat)

		fireEvent.click(screen.getByText('chat go live'))

		await screen.findByTestId('live-screen')
		expect(screen.getByTestId('tab-chat')).toBeTruthy()
		expect(screen.queryByTestId('tab-training')).toBeNull()
	})

	it('a deep link has no tab behind it: the training tab is drawn under the surface', async () => {
		renderApp(TRAINING_LIVE_ROUTE)

		expect(await screen.findByTestId('live-screen')).toBeTruthy()
		expect(screen.getByTestId('tab-training')).toBeTruthy()
		expect(screen.getByRole('navigation', { name: 'main nav' })).toBeTruthy()
	})

	it('«back» removes the surface and leaves the same tab, not remounted', async () => {
		const router = renderApp(ROUTES.training)
		fireEvent.change(screen.getByLabelText('marker'), { target: { value: 'kept' } })
		fireEvent.click(screen.getByText('go live'))
		await screen.findByTestId('live-screen')

		await act(async () => {
			await router.navigate(-1)
		})

		await waitFor(() => {
			expect(screen.queryByTestId('live-screen')).toBeNull()
		}, WAIT)
		expect(screen.getByLabelText<HTMLInputElement>('marker').value).toBe('kept')
		expect(mocks.tabMounts.count).toBe(1)
		expect(screen.getByRole('navigation', { name: 'main nav' })).toBeTruthy()
	})

	it('the tab and the nav under the surface are inert; «back» frees them at once', async () => {
		const router = renderApp(ROUTES.training)
		const nav = screen.getByRole('navigation', { name: 'main nav' })
		expect(nav.closest('[inert]')).toBeNull()
		expect(screen.getByTestId('tab-training').closest('[inert]')).toBeNull()

		fireEvent.click(screen.getByText('go live'))
		await screen.findByTestId('live-screen')
		expect(nav.closest('[inert]')).not.toBeNull()
		expect(screen.getByTestId('tab-training').closest('[inert]')).not.toBeNull()
		expect(screen.getByTestId('live-screen').closest('[inert]')).toBeNull()

		await act(async () => {
			await router.navigate(-1)
		})

		// the fold may still be running: the background is already interactive
		expect(screen.getByRole('navigation', { name: 'main nav' }).closest('[inert]')).toBeNull()
		expect(screen.getByTestId('tab-training').closest('[inert]')).toBeNull()
	})

	it('a deep link: the background is inert too', async () => {
		renderApp(TRAINING_LIVE_ROUTE)

		await screen.findByTestId('live-screen')
		expect(screen.getByTestId('tab-training').closest('[inert]')).not.toBeNull()
		expect(screen.getByRole('navigation', { name: 'main nav' }).closest('[inert]')).not.toBeNull()
	})

	it('focus moves into the surface on open and returns to the opener on close', async () => {
		const router = renderApp(ROUTES.training)
		const opener = screen.getByText('go live')
		opener.focus()

		fireEvent.click(opener)
		const live = await screen.findByTestId('live-screen')
		await waitFor(() => {
			expect(live.closest('[tabindex="-1"]')?.contains(document.activeElement)).toBe(true)
		})

		await act(async () => {
			await router.navigate(-1)
		})
		await waitFor(() => {
			expect(document.activeElement).toBe(opener)
		})
	})

	it('the surface closes under reduced motion too (a fade)', async () => {
		vi.mocked(useReducedMotion).mockReturnValue(true)
		const router = renderApp(ROUTES.training)
		fireEvent.click(screen.getByText('go live'))
		await screen.findByTestId('live-screen')

		await act(async () => {
			await router.navigate(-1)
		})

		await waitFor(() => {
			expect(screen.queryByTestId('live-screen')).toBeNull()
		}, WAIT)
		expect(screen.getByTestId('tab-training')).toBeTruthy()
	})
})

describe('RootLayout: the mini strip', () => {
	it('warms the live chunk up on pointerdown', () => {
		renderApp(ROUTES.training)

		fireEvent.pointerDown(screen.getByRole('link', { name: /Відкрити/ }))

		expect(mocks.preload).toHaveBeenCalledTimes(1)
	})

	it('no live session: no strip', () => {
		hasLiveWorkout = false

		renderApp(ROUTES.training)

		expect(document.querySelector('[data-mini-strip]')).toBeNull()
	})
})

describe('LiveSurface: clip-path', () => {
	it('under reduced motion the surface has no clip-path (it only fades)', async () => {
		vi.mocked(useReducedMotion).mockReturnValue(true)
		renderApp(ROUTES.training)
		expect(document.querySelector('[data-mini-strip]')).not.toBeNull()

		fireEvent.click(screen.getByText('go live'))

		const live = await screen.findByTestId('live-screen')
		const surface = live.closest<HTMLElement>('.overflow-hidden')
		expect(surface).not.toBeNull()
		expect(surface?.style.clipPath ?? '').toBe('')
	})

	it('a deep link (no strip, motion on) does not clip either: it fades in', async () => {
		hasLiveWorkout = false
		renderApp(TRAINING_LIVE_ROUTE)

		const live = await screen.findByTestId('live-screen')

		expect(live.closest<HTMLElement>('.overflow-hidden')?.style.clipPath ?? '').toBe('')
	})
})

describe('LiveSurface: unfolding from the strip', () => {
	it('with the strip and motion on, the surface starts clipped to the strip', async () => {
		renderApp(ROUTES.training)

		fireEvent.click(screen.getByText('go live'))

		const live = await screen.findByTestId('live-screen')
		expect(live.closest<HTMLElement>('.overflow-hidden')?.style.clipPath).toContain('inset(')
	})
})
