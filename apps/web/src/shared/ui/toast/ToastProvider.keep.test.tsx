// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { Link, MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'

import { TOAST_DURATION_MS } from './toast.constants'
import { ToastProvider } from './ToastProvider'
import { ToastRouteReset } from './ToastRouteReset'
import { useToast } from './use-toast'

const EXIT_FLUSH_MS = 1000

const Trigger = () => {
	const toast = useToast()
	return (
		<button
			type="button"
			onClick={() => {
				toast.show('Звичайний')
				toast.show('Залишається', { keepOnNavigation: true })
			}}
		>
			show
		</button>
	)
}

const flush = async (): Promise<void> => {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(EXIT_FLUSH_MS)
	})
}

beforeEach(() => {
	MotionGlobalConfig.skipAnimations = true
	vi.useFakeTimers()
})

afterEach(() => {
	cleanup()
	MotionGlobalConfig.skipAnimations = false
	vi.useRealTimers()
})

describe('ToastProvider: keepOnNavigation', () => {
	const renderScreen = (): void => {
		render(
			<MemoryRouter initialEntries={['/a']}>
				<ToastProvider>
					<ToastRouteReset />
					<Trigger />
					<Link to="/b">b</Link>
					<Link to="/c">c</Link>
				</ToastProvider>
			</MemoryRouter>,
		)
		fireEvent.click(screen.getByText('show'))
	}

	it('closes an ordinary toast on the route change and keeps only the flagged one', async () => {
		renderScreen()

		fireEvent.click(screen.getByText('b'))
		await flush()

		expect(screen.queryByText('Звичайний')).toBeNull()
		expect(screen.queryByText('Залишається')).not.toBeNull()
	})

	it('the second route change closes the kept toast too', async () => {
		renderScreen()

		fireEvent.click(screen.getByText('b'))
		await flush()
		fireEvent.click(screen.getByText('c'))
		await flush()

		expect(screen.queryByText('Залишається')).toBeNull()
	})

	it('a kept toast still goes away by its own timer', async () => {
		renderScreen()
		fireEvent.click(screen.getByText('b'))
		await flush()

		act(() => {
			vi.advanceTimersByTime(TOAST_DURATION_MS)
		})
		await flush()

		expect(screen.queryByText('Залишається')).toBeNull()
	})
})
