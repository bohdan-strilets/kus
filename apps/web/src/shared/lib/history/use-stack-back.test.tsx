// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { createBrowserRouter, useLocation, useNavigate } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, describe, expect, it } from 'vitest'

import { getHistoryIndex } from './get-history-index'
import { useStackBack } from './use-stack-back'

const PARENT = '/app/profile'
const CHILD = '/app/settings'

const Screen = () => {
	const { pathname } = useLocation()
	const navigate = useNavigate()
	const goBack = useStackBack(PARENT)

	return (
		<div>
			<output data-testid="path">{pathname}</output>
			<button type="button" onClick={() => void navigate(CHILD)}>
				open
			</button>
			<button type="button" onClick={goBack}>
				back
			</button>
		</div>
	)
}

let disposeRouter: (() => void) | null = null

/** jsdom keeps one session history per file: every test starts over at a fresh first entry. */
const renderAt = (path: string): void => {
	window.history.replaceState(null, '', path)
	const router = createBrowserRouter([{ path: '*', element: <Screen /> }])
	// the router keeps listening to popstate after unmount: not into the next test
	disposeRouter = () => {
		router.dispose()
	}
	render(<RouterProvider router={router} />)
}

const click = async (name: string): Promise<void> => {
	await act(async () => {
		screen.getByText(name).click()
		await Promise.resolve()
	})
}

const pathname = (): string => screen.getByTestId('path').textContent

afterEach(() => {
	cleanup()
	disposeRouter?.()
	disposeRouter = null
})

describe('useStackBack', () => {
	it('goes back to the entry the screen was opened from', async () => {
		renderAt('/app/today')
		await click('open')
		expect(pathname()).toBe(CHILD)
		expect(getHistoryIndex(window.history.state)).toBe(1)

		// jsdom traverses the history in a later task and reports through popstate, like a browser
		await act(async () => {
			const popped = new Promise<void>((resolve) => {
				window.addEventListener(
					'popstate',
					() => {
						resolve()
					},
					{ once: true },
				)
			})
			screen.getByText('back').click()
			await popped
		})
		await waitFor(() => {
			expect(pathname()).toBe('/app/today')
		})
		expect(getHistoryIndex(window.history.state)).toBe(0)
	})

	it('with nothing behind (a deep link) replaces the entry with the parent', async () => {
		renderAt(CHILD)
		expect(getHistoryIndex(window.history.state)).toBe(0)

		await click('back')
		expect(pathname()).toBe(PARENT)
		expect(getHistoryIndex(window.history.state)).toBe(0)
	})
})
