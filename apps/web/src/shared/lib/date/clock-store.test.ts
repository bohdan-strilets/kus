// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLocalDate, useLocalHour } from './clock-store'

const WARSAW = 'Europe/Warsaw'
/** 23:59:30 in Warsaw (UTC+2) on 12 October. */
const BEFORE_MIDNIGHT = '2026-10-12T21:59:30.000Z'
/** 00:10 in Warsaw on 13 October. */
const AFTER_MIDNIGHT = '2026-10-12T22:10:00.000Z'
const MINUTE_MS = 60_000
const HALF_MINUTE_MS = 30_000
const OBSERVED_EVENTS = ['visibilitychange', 'pageshow', 'focus']

const setVisibility = (state: DocumentVisibilityState): void => {
	Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

const fire = (type: string): void => {
	act(() => {
		if (type === 'visibilitychange') {
			document.dispatchEvent(new Event(type, { bubbles: true }))
			return
		}
		window.dispatchEvent(new Event(type))
	})
}

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(new Date(BEFORE_MIDNIGHT))
	setVisibility('visible')
})

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
	vi.useRealTimers()
	Reflect.deleteProperty(document, 'visibilityState')
})

describe('useLocalDate', () => {
	it('moves to the new day on the minute tick, with no events at all', () => {
		const { result } = renderHook(() => useLocalDate(WARSAW))
		expect(result.current).toBe('2026-10-12')

		act(() => {
			vi.advanceTimersByTime(HALF_MINUTE_MS)
		})

		expect(result.current).toBe('2026-10-13')
	})

	it('keeps ticking every minute after the first boundary', () => {
		vi.setSystemTime(new Date('2026-10-12T21:58:45.000Z'))
		const { result } = renderHook(() => useLocalDate(WARSAW))

		act(() => {
			vi.advanceTimersByTime(MINUTE_MS)
		})
		expect(result.current).toBe('2026-10-12')

		act(() => {
			vi.advanceTimersByTime(MINUTE_MS)
		})
		expect(result.current).toBe('2026-10-13')
	})

	it.each(['pageshow', 'focus', 'visibilitychange'])(
		'recomputes at once on %s after the clock jumped over midnight without a tick',
		(eventType) => {
			const { result } = renderHook(() => useLocalDate(WARSAW))
			expect(result.current).toBe('2026-10-12')

			vi.setSystemTime(new Date(AFTER_MIDNIGHT))
			fire(eventType)

			expect(result.current).toBe('2026-10-13')
		},
	)

	it('does not recompute when the page becomes hidden, and does not break', () => {
		const { result } = renderHook(() => useLocalDate(WARSAW))
		vi.setSystemTime(new Date(AFTER_MIDNIGHT))
		setVisibility('hidden')

		expect(() => {
			fire('visibilitychange')
		}).not.toThrow()
		expect(result.current).toBe('2026-10-12')

		setVisibility('visible')
		fire('visibilitychange')
		expect(result.current).toBe('2026-10-13')
	})

	it('shares one timer between all subscribers', () => {
		expect(vi.getTimerCount()).toBe(0)
		const first = renderHook(() => useLocalDate(WARSAW))
		const timersForOne = vi.getTimerCount()
		expect(timersForOne).toBeGreaterThan(0)

		const second = renderHook(() => useLocalDate(WARSAW))
		const third = renderHook(() => useLocalHour(WARSAW))

		expect(vi.getTimerCount()).toBe(timersForOne)
		first.unmount()
		second.unmount()
		third.unmount()
	})

	it('removes the timer and the window listeners after the last unsubscribe', () => {
		const addSpy = vi.spyOn(window, 'addEventListener')
		const removeSpy = vi.spyOn(window, 'removeEventListener')
		const documentAddSpy = vi.spyOn(document, 'addEventListener')
		const documentRemoveSpy = vi.spyOn(document, 'removeEventListener')
		const first = renderHook(() => useLocalDate(WARSAW))
		const second = renderHook(() => useLocalHour(WARSAW))

		first.unmount()
		expect(vi.getTimerCount()).toBeGreaterThan(0)
		second.unmount()

		expect(vi.getTimerCount()).toBe(0)
		const added = [...addSpy.mock.calls, ...documentAddSpy.mock.calls].filter(([type]) =>
			OBSERVED_EVENTS.includes(type),
		)
		const removed = [...removeSpy.mock.calls, ...documentRemoveSpy.mock.calls].filter(([type]) =>
			OBSERVED_EVENTS.includes(type),
		)
		for (const type of OBSERVED_EVENTS) {
			expect(added.some(([addedType]) => addedType === type)).toBe(true)
			expect(removed.some(([removedType]) => removedType === type)).toBe(true)
		}
		for (const [type, handler] of added) {
			expect(
				removed.some(
					([removedType, removedHandler]) => removedType === type && removedHandler === handler,
				),
			).toBe(true)
		}
	})

	it('starts again for a new subscriber after everyone left', () => {
		renderHook(() => useLocalDate(WARSAW)).unmount()
		expect(vi.getTimerCount()).toBe(0)

		const { result } = renderHook(() => useLocalDate(WARSAW))
		expect(vi.getTimerCount()).toBeGreaterThan(0)
		act(() => {
			vi.advanceTimersByTime(HALF_MINUTE_MS)
		})

		expect(result.current).toBe('2026-10-13')
	})

	it('follows the timezone: 22:30 UTC is already tomorrow in Warsaw but still today in UTC', () => {
		vi.setSystemTime(new Date('2026-10-12T22:30:00.000Z'))

		const warsaw = renderHook(() => useLocalDate(WARSAW))
		const utc = renderHook(() => useLocalDate('UTC'))

		expect(warsaw.result.current).toBe('2026-10-13')
		expect(utc.result.current).toBe('2026-10-12')
	})
})

describe('useLocalHour', () => {
	it('returns the new hour at the boundary', () => {
		vi.setSystemTime(new Date('2026-10-12T08:59:30.000Z'))
		const { result } = renderHook(() => useLocalHour(WARSAW))
		expect(result.current).toBe(10)

		act(() => {
			vi.advanceTimersByTime(HALF_MINUTE_MS)
		})

		expect(result.current).toBe(11)
	})

	it('does not re-render while the hour stays the same', () => {
		vi.setSystemTime(new Date('2026-10-12T08:10:00.000Z'))
		let renders = 0
		const { result } = renderHook(() => {
			renders += 1
			return useLocalHour(WARSAW)
		})
		const rendersAfterMount = renders

		act(() => {
			vi.advanceTimersByTime(5 * MINUTE_MS)
		})
		fire('focus')
		fire('pageshow')

		expect(result.current).toBe(10)
		expect(renders).toBe(rendersAfterMount)
	})

	it('does not re-render useLocalDate subscribers on the same day either', () => {
		vi.setSystemTime(new Date('2026-10-12T08:10:00.000Z'))
		let renders = 0
		renderHook(() => {
			renders += 1
			return useLocalDate(WARSAW)
		})
		const rendersAfterMount = renders

		act(() => {
			vi.advanceTimersByTime(10 * MINUTE_MS)
		})

		expect(renders).toBe(rendersAfterMount)
	})
})
