// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	VIEWPORT_SETTLE_MAX_MS,
	VIEWPORT_SETTLE_MIN_MS,
	VIEWPORT_SETTLE_STABLE_FRAMES,
} from './viewport-settle'

interface FakeVisualViewport extends EventTarget {
	height: number
	offsetTop: number
	scale: number
}

const FULL = { height: 873, offsetTop: 0 }
const KEYBOARD = { height: 458, offsetTop: 415 }
const FRAME_MS = 16

const installViewport = (viewport: FakeVisualViewport | undefined): void => {
	Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
}

const setBox = (viewport: FakeVisualViewport, box: { height: number; offsetTop: number }): void => {
	viewport.height = box.height
	viewport.offsetTop = box.offsetTop
}

// the store is module state: a fresh module per test keeps tests order-independent
const loadModule = async () => {
	vi.resetModules()
	return import('./use-viewport-box')
}

const advance = (ms: number): void => {
	act(() => {
		vi.advanceTimersByTime(ms)
	})
}

const fire = (target: EventTarget, type: string): void => {
	act(() => {
		target.dispatchEvent(new Event(type))
	})
}

const addField = (): HTMLInputElement => {
	const input = document.createElement('input')
	document.body.append(input)
	return input
}

describe('viewport store', () => {
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
	})

	afterEach(() => {
		cleanup()
		vi.useRealTimers()
		installViewport(undefined)
		document.body.replaceChildren()
	})

	describe('settle loop', () => {
		it('publishes a late value change that came without any event', async () => {
			const { useViewportBox } = await loadModule()
			const { result } = renderHook(() => useViewportBox())
			fire(window, 'focus')
			expect(result.current).toEqual(FULL)

			setBox(viewport, KEYBOARD)
			advance(FRAME_MS * 2)

			expect(result.current).toEqual(KEYBOARD)
		})

		it('stops polling after the box was stable long enough', async () => {
			const { useViewportBox } = await loadModule()
			renderHook(() => useViewportBox())
			fire(window, 'focus')
			expect(vi.getTimerCount()).toBe(1)

			advance(VIEWPORT_SETTLE_MIN_MS - FRAME_MS * 2)
			expect(vi.getTimerCount()).toBe(1)

			advance(FRAME_MS * (VIEWPORT_SETTLE_STABLE_FRAMES + 2))
			expect(vi.getTimerCount()).toBe(0)
		})

		it('stops at the maximum even while the box keeps changing', async () => {
			const { useViewportBox } = await loadModule()
			renderHook(() => useViewportBox())
			fire(window, 'focus')

			let height = 500
			for (let elapsed = 0; elapsed < VIEWPORT_SETTLE_MAX_MS - FRAME_MS * 2; elapsed += FRAME_MS) {
				height += 1
				viewport.height = height
				advance(FRAME_MS)
			}
			expect(vi.getTimerCount()).toBe(1)

			advance(FRAME_MS * 4)
			expect(vi.getTimerCount()).toBe(0)
		})

		it('a new trigger extends the loop', async () => {
			const { useViewportBox } = await loadModule()
			renderHook(() => useViewportBox())
			fire(window, 'focus')
			advance(VIEWPORT_SETTLE_MIN_MS - FRAME_MS * 2)
			fire(window, 'focus')
			advance(VIEWPORT_SETTLE_MIN_MS - FRAME_MS * 2)

			expect(vi.getTimerCount()).toBe(1)
		})

		it('requestViewportResync reads at once and starts polling', async () => {
			const { useViewportBox, requestViewportResync } = await loadModule()
			const { result } = renderHook(() => useViewportBox())
			setBox(viewport, KEYBOARD)
			act(() => {
				requestViewportResync()
			})
			expect(result.current).toEqual(KEYBOARD)
			expect(vi.getTimerCount()).toBe(1)
		})

		it('unsubscribing cancels the pending frame', async () => {
			const { useViewportBox } = await loadModule()
			const cancel = vi.spyOn(window, 'cancelAnimationFrame')
			const { unmount } = renderHook(() => useViewportBox())
			fire(window, 'focus')
			expect(vi.getTimerCount()).toBe(1)

			unmount()

			expect(cancel).toHaveBeenCalled()
			expect(vi.getTimerCount()).toBe(0)
		})
	})

	describe('keyboard height', () => {
		it('is the full height minus the visual viewport', async () => {
			const { useKeyboardPx } = await loadModule()
			const { result } = renderHook(() => useKeyboardPx())
			expect(result.current).toBe(0)

			const field = addField()
			act(() => {
				field.focus()
			})
			setBox(viewport, KEYBOARD)
			fire(viewport, 'resize')

			expect(result.current).toBe(415)
		})

		it('follows a growing full height while no field is focused', async () => {
			const { useKeyboardPx } = await loadModule()
			const { result } = renderHook(() => useKeyboardPx())
			setBox(viewport, { height: 900, offsetTop: 0 })
			fire(viewport, 'resize')
			setBox(viewport, { height: 500, offsetTop: 400 })
			fire(viewport, 'resize')

			expect(result.current).toBe(400)
		})

		it('ignores growth while a field is focused', async () => {
			const { useKeyboardPx } = await loadModule()
			const { result } = renderHook(() => useKeyboardPx())
			const field = addField()
			act(() => {
				field.focus()
			})
			setBox(viewport, { height: 950, offsetTop: 0 })
			fire(viewport, 'resize')
			setBox(viewport, KEYBOARD)
			fire(viewport, 'resize')

			expect(result.current).toBe(415)
		})

		it('resets on orientationchange', async () => {
			const { useKeyboardPx } = await loadModule()
			const { result } = renderHook(() => useKeyboardPx())
			setBox(viewport, { height: 393, offsetTop: 0 })
			fire(window, 'orientationchange')
			advance(FRAME_MS * 2)

			expect(result.current).toBe(0)
		})

		it('resets on a window resize without focus', async () => {
			const { useKeyboardPx } = await loadModule()
			const { result } = renderHook(() => useKeyboardPx())
			setBox(viewport, { height: 700, offsetTop: 0 })
			fire(window, 'resize')
			advance(FRAME_MS * 2)

			expect(result.current).toBe(0)
		})
	})
})
