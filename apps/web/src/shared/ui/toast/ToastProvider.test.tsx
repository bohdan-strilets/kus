// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { Link, MemoryRouter } from 'react-router'
import { MotionGlobalConfig } from 'motion/react'

import '@/shared/i18n'

import { TOAST_ACTION_DURATION_MS, TOAST_DURATION_MS } from './toast.constants'
import { ToastProvider } from './ToastProvider'
import { ToastRouteReset } from './ToastRouteReset'
import { useToast } from './use-toast'

afterEach(cleanup)

const Trigger = ({ onClick }: { onClick?: () => void }) => {
	const toast = useToast()
	return (
		<button
			type="button"
			onClick={() => {
				toast.show(
					'Замір видалено',
					onClick ? { action: { label: 'Повернути', onClick } } : undefined,
				)
			}}
		>
			show
		</button>
	)
}

describe('ToastProvider', () => {
	it('shows a plain message without a button', async () => {
		render(
			<ToastProvider>
				<Trigger />
			</ToastProvider>,
		)

		fireEvent.click(screen.getByText('show'))

		expect(await screen.findByText('Замір видалено')).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Повернути' })).toBeNull()
	})

	it('shows its action and calls it on tap', async () => {
		const onClick = vi.fn()
		render(
			<ToastProvider>
				<Trigger onClick={onClick} />
			</ToastProvider>,
		)

		fireEvent.click(screen.getByText('show'))
		const action = await screen.findByRole('button', { name: 'Повернути' })
		act(() => {
			action.click()
		})

		expect(onClick).toHaveBeenCalledTimes(1)
	})

	it('renders the action as a tap-sized button without underline', async () => {
		render(
			<ToastProvider>
				<Trigger onClick={vi.fn()} />
			</ToastProvider>,
		)

		fireEvent.click(screen.getByText('show'))
		const action = await screen.findByRole('button', { name: 'Повернути' })

		expect(action.tagName).toBe('BUTTON')
		expect(action.classList.contains('min-h-tap')).toBe(true)
		expect(action.classList.contains('underline')).toBe(false)
	})
})

// room for the exit animation to finish and unmount the node
const EXIT_FLUSH_MS = 500

describe('ToastProvider timers', () => {
	const setHidden = (isHidden: boolean): void => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: isHidden })
		document.dispatchEvent(new Event('visibilitychange'))
	}

	beforeEach(() => {
		// the exit animation would keep the node in the DOM while the fake clock is frozen
		MotionGlobalConfig.skipAnimations = true
		vi.useFakeTimers()
	})

	afterEach(() => {
		setHidden(false)
		MotionGlobalConfig.skipAnimations = false
		vi.useRealTimers()
	})

	const expectToastGone = async (): Promise<void> => {
		await act(async () => {
			await vi.advanceTimersByTimeAsync(EXIT_FLUSH_MS)
		})
		expect(screen.queryByText('Замір видалено')).toBeNull()
	}

	const renderTrigger = (onClick?: () => void): void => {
		render(
			<ToastProvider>
				<Trigger onClick={onClick} />
			</ToastProvider>,
		)
		fireEvent.click(screen.getByText('show'))
	}

	it('closes a plain toast after 5 s', async () => {
		renderTrigger()
		expect(screen.queryByText('Замір видалено')).not.toBeNull()

		act(() => {
			vi.advanceTimersByTime(TOAST_DURATION_MS - 1)
		})
		expect(screen.queryByText('Замір видалено')).not.toBeNull()

		act(() => {
			vi.advanceTimersByTime(1)
		})
		await expectToastGone()
	})

	it('keeps a toast with an action for 6 s', async () => {
		renderTrigger(vi.fn())

		act(() => {
			vi.advanceTimersByTime(TOAST_ACTION_DURATION_MS - 1)
		})
		expect(screen.queryByText('Замір видалено')).not.toBeNull()

		act(() => {
			vi.advanceTimersByTime(1)
		})
		await expectToastGone()
	})

	it('still closes after a touch and focus on the toast', async () => {
		renderTrigger(vi.fn())
		const toast = screen.getByText('Замір видалено')

		fireEvent.pointerDown(toast)
		fireEvent.pointerEnter(toast)
		fireEvent.focus(screen.getByRole('button', { name: 'Повернути' }))
		act(() => {
			vi.advanceTimersByTime(TOAST_ACTION_DURATION_MS)
		})

		await expectToastGone()
	})

	it('stops the timer while the document is hidden and resumes with the time left', async () => {
		renderTrigger()

		act(() => {
			vi.advanceTimersByTime(3000)
		})
		act(() => {
			setHidden(true)
		})
		act(() => {
			vi.advanceTimersByTime(60_000)
		})
		expect(screen.queryByText('Замір видалено')).not.toBeNull()

		act(() => {
			setHidden(false)
		})
		act(() => {
			vi.advanceTimersByTime(TOAST_DURATION_MS - 3000 - 1)
		})
		expect(screen.queryByText('Замір видалено')).not.toBeNull()

		act(() => {
			vi.advanceTimersByTime(1)
		})
		await expectToastGone()
	})

	it('closes all toasts on a route change, not on the first render', async () => {
		render(
			<MemoryRouter initialEntries={['/memory']}>
				<ToastProvider>
					<ToastRouteReset />
					<Trigger />
					<Link to="/profile">go</Link>
				</ToastProvider>
			</MemoryRouter>,
		)
		fireEvent.click(screen.getByText('show'))
		expect(screen.queryByText('Замір видалено')).not.toBeNull()

		fireEvent.click(screen.getByText('go'))

		await expectToastGone()
	})
})
