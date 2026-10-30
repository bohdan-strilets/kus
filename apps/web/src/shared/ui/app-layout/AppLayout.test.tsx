// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface FakeVisualViewport extends EventTarget {
	height: number
	offsetTop: number
	scale: number
}

const FULL = { height: 873, offsetTop: 0 }
const KEYBOARD = { height: 458, offsetTop: 415 }
const PAST_GRACE_MS = 800

const installViewport = (viewport: FakeVisualViewport | undefined): void => {
	Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
}

const installPointer = (isCoarse: boolean): void => {
	window.matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: isCoarse && query === '(pointer: coarse)',
		media: query,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	}))
}

// the viewport store is module state: a fresh AppLayout module per test
const renderLayout = async () => {
	vi.resetModules()
	const { AppLayout } = await import('./AppLayout')
	render(
		<AppLayout bottomNav={<nav aria-label="tabs">tabs</nav>}>
			<input aria-label="field" />
		</AppLayout>,
	)
}

const hasNav = (): boolean => screen.queryByRole('navigation', { name: 'tabs' }) !== null

const resizeTo = (viewport: FakeVisualViewport, box: typeof FULL): void => {
	viewport.height = box.height
	viewport.offsetTop = box.offsetTop
	act(() => {
		viewport.dispatchEvent(new Event('resize'))
	})
}

describe('AppLayout bottom nav and the keyboard', () => {
	let viewport: FakeVisualViewport

	beforeEach(() => {
		vi.useFakeTimers({
			toFake: [
				'setTimeout',
				'clearTimeout',
				'requestAnimationFrame',
				'cancelAnimationFrame',
				'performance',
			],
		})
		viewport = Object.assign(new EventTarget(), { ...FULL, scale: 1 })
		installViewport(viewport)
		installPointer(true)
	})

	afterEach(() => {
		cleanup()
		vi.useRealTimers()
		installViewport(undefined)
		Reflect.deleteProperty(window, 'matchMedia')
	})

	it('shows the nav with no field focused', async () => {
		await renderLayout()
		expect(hasNav()).toBe(true)
	})

	it('hides it on focus while the keyboard is coming, shows it if none follows within 700 ms', async () => {
		await renderLayout()
		act(() => {
			screen.getByLabelText('field').focus()
		})
		expect(hasNav()).toBe(false)

		act(() => {
			vi.advanceTimersByTime(PAST_GRACE_MS)
		})
		expect(hasNav()).toBe(true)
	})

	it('keeps it hidden while the viewport is shrunk, even after focusout', async () => {
		await renderLayout()
		const field = screen.getByLabelText('field')
		act(() => {
			field.focus()
		})
		resizeTo(viewport, KEYBOARD)
		act(() => {
			vi.advanceTimersByTime(PAST_GRACE_MS)
		})
		expect(hasNav()).toBe(false)

		act(() => {
			field.blur()
		})
		expect(hasNav()).toBe(false)

		resizeTo(viewport, FULL)
		expect(hasNav()).toBe(true)
	})

	it('keeps the nav on a fine pointer even with a focused field and a shrunk viewport', async () => {
		installPointer(false)
		await renderLayout()
		act(() => {
			screen.getByLabelText('field').focus()
		})
		resizeTo(viewport, KEYBOARD)
		expect(hasNav()).toBe(true)
	})
})
