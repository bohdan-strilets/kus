// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { Link, MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'

import { TOAST_ACTION_DURATION_MS, TOAST_DURATION_MS } from './toast.constants'
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

describe('ToastProvider: keepUntilExpired', () => {
	const UndoTrigger = () => {
		const toast = useToast()
		return (
			<>
				<button
					type="button"
					onClick={() => {
						toast.show('Звичайний')
						toast.show('Прибрав', {
							keepUntilExpired: true,
							action: { label: 'Скасувати', onClick: () => undefined },
						})
					}}
				>
					undo
				</button>
				<button
					type="button"
					onClick={() => {
						toast.show('Інша дія', { action: { label: 'Повернути', onClick: () => undefined } })
					}}
				>
					other
				</button>
			</>
		)
	}

	const renderUndo = (): void => {
		render(
			<MemoryRouter initialEntries={['/a']}>
				<ToastProvider>
					<ToastRouteReset />
					<UndoTrigger />
					<Link to="/b">b</Link>
					<Link to="/c">c</Link>
				</ToastProvider>
			</MemoryRouter>,
		)
		fireEvent.click(screen.getByText('undo'))
	}

	it('survives every route change while an ordinary toast is closed', async () => {
		renderUndo()

		fireEvent.click(screen.getByText('b'))
		await flush()
		fireEvent.click(screen.getByText('c'))
		await flush()

		expect(screen.queryByText('Звичайний')).toBeNull()
		expect(screen.queryByText('Прибрав')).not.toBeNull()
	})

	it('goes away by its own timer after navigation', async () => {
		renderUndo()
		fireEvent.click(screen.getByText('b'))
		await flush()

		act(() => {
			vi.advanceTimersByTime(TOAST_ACTION_DURATION_MS)
		})
		await flush()

		expect(screen.queryByText('Прибрав')).toBeNull()
	})

	it('is replaced by another toast with an action', async () => {
		renderUndo()
		fireEvent.click(screen.getByText('b'))
		await flush()

		fireEvent.click(screen.getByText('other'))
		await flush()

		expect(screen.queryByText('Прибрав')).toBeNull()
		expect(screen.queryByText('Інша дія')).not.toBeNull()
	})
})
