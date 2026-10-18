// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewportBox } from './viewport-box'

interface FakeVisualViewport extends EventTarget {
	height: number
	offsetTop: number
	scale: number
}

const KEYBOARD_BOX = { height: 456, offsetTop: 290 }
const FRESH_BOX = { height: 844, offsetTop: 0 }

const RESUME_EVENTS = [
	{ name: 'document visibilitychange', target: 'document', type: 'visibilitychange' },
	{ name: 'window pageshow', target: 'window', type: 'pageshow' },
	{ name: 'window focus', target: 'window', type: 'focus' },
	{ name: 'window orientationchange', target: 'window', type: 'orientationchange' },
] as const

const TARGETS: Record<'document' | 'window', EventTarget> = { document, window }

const setVisibilityState = (state: DocumentVisibilityState): void => {
	Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

const createFakeViewport = (box: { height: number; offsetTop: number }): FakeVisualViewport =>
	Object.assign(new EventTarget(), { ...box, scale: 1 })

const installViewport = (viewport: FakeVisualViewport | undefined): void => {
	Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
}

// `current` in the hook module is shared state: a fresh module per test keeps tests order-independent.
const loadHook = async (): Promise<() => ViewportBox> => {
	vi.resetModules()
	const module = await import('./use-viewport-box')
	return module.useViewportBox
}

describe('useViewportBox', () => {
	let viewport: FakeVisualViewport

	beforeEach(() => {
		viewport = createFakeViewport(KEYBOARD_BOX)
		installViewport(viewport)
		setVisibilityState('visible')
	})

	afterEach(() => {
		vi.restoreAllMocks()
		installViewport(undefined)
		Reflect.deleteProperty(document, 'visibilityState')
	})

	it('reads the initial visual viewport', async () => {
		const useViewportBox = await loadHook()
		const { result } = renderHook(() => useViewportBox())
		expect(result.current).toEqual(KEYBOARD_BOX)
	})

	it.each(RESUME_EVENTS)(
		're-reads a stale box on $name without any visualViewport event',
		async ({ target, type }) => {
			const useViewportBox = await loadHook()
			const { result } = renderHook(() => useViewportBox())
			expect(result.current).toEqual(KEYBOARD_BOX)

			viewport.height = FRESH_BOX.height
			viewport.offsetTop = FRESH_BOX.offsetTop
			act(() => {
				TARGETS[target].dispatchEvent(new Event(type))
			})

			expect(result.current).toEqual(FRESH_BOX)
		},
	)

	it('ignores visibilitychange to hidden, then re-reads on visible', async () => {
		const useViewportBox = await loadHook()
		const { result } = renderHook(() => useViewportBox())

		viewport.height = FRESH_BOX.height
		viewport.offsetTop = FRESH_BOX.offsetTop
		setVisibilityState('hidden')
		act(() => {
			document.dispatchEvent(new Event('visibilitychange'))
		})
		expect(result.current).toEqual(KEYBOARD_BOX)

		setVisibilityState('visible')
		act(() => {
			document.dispatchEvent(new Event('visibilitychange'))
		})
		expect(result.current).toEqual(FRESH_BOX)
	})

	it.each(['resize', 'scroll'])('still follows visualViewport %s', async (type) => {
		const useViewportBox = await loadHook()
		const { result } = renderHook(() => useViewportBox())

		viewport.height = FRESH_BOX.height
		viewport.offsetTop = FRESH_BOX.offsetTop
		act(() => {
			viewport.dispatchEvent(new Event(type))
		})

		expect(result.current).toEqual(FRESH_BOX)
	})

	it('removes every added listener on unmount, with the same handler', async () => {
		const useViewportBox = await loadHook()
		const watchedTypes = new Set<string>([
			...RESUME_EVENTS.map((event) => event.type),
			'resize',
			'scroll',
		])
		const added: Array<{ type: string; handler: unknown }> = []
		const removed: Array<{ type: string; handler: unknown }> = []
		type ListenerOptions = boolean | AddEventListenerOptions | EventListenerOptions
		type ListenerMethod = (
			type: string,
			handler: EventListenerOrEventListenerObject | null,
			options?: ListenerOptions,
		) => void
		const track = (
			target: EventTarget,
			method: 'addEventListener' | 'removeEventListener',
			list: typeof added,
		): void => {
			const original = target[method].bind(target)
			const spy: ListenerMethod = (type, handler, options) => {
				if (watchedTypes.has(type)) list.push({ type, handler })
				original(type, handler, options)
			}
			vi.spyOn(target, method).mockImplementation(spy)
		}
		for (const target of [window, document, viewport]) {
			track(target, 'addEventListener', added)
			track(target, 'removeEventListener', removed)
		}

		const { unmount } = renderHook(() => useViewportBox())
		const addedTypes = added.map((entry) => entry.type)
		for (const type of ['resize', 'scroll', ...RESUME_EVENTS.map((event) => event.type)]) {
			expect(addedTypes, `expected ${type} listener to be added`).toContain(type)
		}

		unmount()

		for (const entry of added) {
			const isRemoved = removed.some(
				(candidate) => candidate.type === entry.type && candidate.handler === entry.handler,
			)
			expect(isRemoved, `expected ${entry.type} listener to be removed`).toBe(true)
		}
	})

	it('does not react to events after unmount', async () => {
		const useViewportBox = await loadHook()
		let renders = 0
		const { result, unmount } = renderHook(() => {
			renders += 1
			return useViewportBox()
		})
		unmount()
		const rendersAtUnmount = renders

		viewport.height = FRESH_BOX.height
		viewport.offsetTop = FRESH_BOX.offsetTop
		act(() => {
			viewport.dispatchEvent(new Event('resize'))
			viewport.dispatchEvent(new Event('scroll'))
			document.dispatchEvent(new Event('visibilitychange'))
			for (const type of ['pageshow', 'focus', 'orientationchange']) {
				window.dispatchEvent(new Event(type))
			}
		})

		expect(renders).toBe(rendersAtUnmount)
		expect(result.current).toEqual(KEYBOARD_BOX)
	})

	it('without visualViewport falls back to the empty box and does not throw on events', async () => {
		installViewport(undefined)
		const useViewportBox = await loadHook()
		const { result, unmount } = renderHook(() => useViewportBox())
		expect(result.current).toEqual({ height: null, offsetTop: 0 })

		expect(() => {
			act(() => {
				document.dispatchEvent(new Event('visibilitychange'))
				window.dispatchEvent(new Event('pageshow'))
				window.dispatchEvent(new Event('focus'))
				window.dispatchEvent(new Event('orientationchange'))
			})
		}).not.toThrow()
		expect(result.current).toEqual({ height: null, offsetTop: 0 })
		expect(() => {
			unmount()
		}).not.toThrow()
	})
})
