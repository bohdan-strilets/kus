// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'
import { ToastProvider, useToast } from '@/shared/ui'

import { RouterRoot } from './RouterRoot'

/** Long enough for the exit animation (skipped) and the removal to settle. */
const EXIT_FLUSH_MS = 50
const MESSAGE = 'Продукт видалено'

const Trigger = () => {
	const toast = useToast()
	return (
		<button
			type="button"
			onClick={() => {
				toast.show(MESSAGE)
			}}
		>
			show
		</button>
	)
}

/** Two layouts like the app's tabs (RootLayout) and the profile stack (StackLayout). */
const renderRoutes = (initialPath: string) => {
	const router = createMemoryRouter(
		[
			{
				element: <RouterRoot />,
				children: [
					{
						element: <Outlet />,
						children: [{ path: '/app', element: <Link to="/app/memory">memory</Link> }],
					},
					{
						element: <Outlet />,
						children: [
							{
								path: '/app/memory',
								element: (
									<>
										<Trigger />
										<Link to="/app/profile">back</Link>
										<Link to="/app">chat</Link>
									</>
								),
							},
							{ path: '/app/profile', element: <p>profile</p> },
						],
					},
				],
			},
		],
		{ initialEntries: [initialPath] },
	)
	render(
		<ToastProvider>
			<RouterProvider router={router} />
		</ToastProvider>,
	)
}

const expectToastGone = async (): Promise<void> => {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(EXIT_FLUSH_MS)
	})
	expect(screen.queryByText(MESSAGE)).toBeNull()
}

describe('RouterRoot', () => {
	beforeEach(() => {
		MotionGlobalConfig.skipAnimations = true
		vi.useFakeTimers()
	})

	afterEach(() => {
		cleanup()
		vi.useRealTimers()
		MotionGlobalConfig.skipAnimations = false
	})

	it('closes a toast on «Назад» inside the profile stack', async () => {
		renderRoutes('/app/memory')
		fireEvent.click(screen.getByText('show'))
		expect(screen.queryByText(MESSAGE)).not.toBeNull()

		fireEvent.click(screen.getByText('back'))

		await expectToastGone()
	})

	it('closes a toast on a move to another layout', async () => {
		renderRoutes('/app/memory')
		fireEvent.click(screen.getByText('show'))

		fireEvent.click(screen.getByText('chat'))

		await expectToastGone()
	})
})
