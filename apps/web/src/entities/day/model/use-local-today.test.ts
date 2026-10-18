// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLocalToday } from './use-local-today'

const WARSAW = 'Europe/Warsaw'
/** 23:59:30 in Warsaw (UTC+2) on 12 October. */
const BEFORE_MIDNIGHT = '2026-10-12T21:59:30.000Z'
/** 00:10 in Warsaw on 13 October. */
const AFTER_MIDNIGHT = '2026-10-12T22:10:00.000Z'
const MINUTE_MS = 60_000

const setVisibility = (state: DocumentVisibilityState): void => {
	Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(new Date(BEFORE_MIDNIGHT))
	setVisibility('visible')
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
	Reflect.deleteProperty(document, 'visibilityState')
})

describe('useLocalToday', () => {
	it('returns today in the given timezone', () => {
		const { result } = renderHook(() => useLocalToday(WARSAW))

		expect(result.current).toBe('2026-10-12')
	})

	it('differs by timezone around midnight', () => {
		vi.setSystemTime(new Date('2026-10-12T22:30:00.000Z'))

		expect(renderHook(() => useLocalToday(WARSAW)).result.current).toBe('2026-10-13')
		expect(renderHook(() => useLocalToday('UTC')).result.current).toBe('2026-10-12')
	})

	it('moves on at midnight while the tab stays open', () => {
		const { result } = renderHook(() => useLocalToday(WARSAW))

		act(() => {
			vi.advanceTimersByTime(MINUTE_MS)
		})

		expect(result.current).toBe('2026-10-13')
	})

	it('moves on when the page comes back visible after the clock jumped', () => {
		const { result } = renderHook(() => useLocalToday(WARSAW))

		vi.setSystemTime(new Date(AFTER_MIDNIGHT))
		act(() => {
			document.dispatchEvent(new Event('visibilitychange'))
		})

		expect(result.current).toBe('2026-10-13')
	})

	it('moves on on pageshow after a paused PWA resumed past midnight', () => {
		const { result } = renderHook(() => useLocalToday(WARSAW))

		vi.setSystemTime(new Date(AFTER_MIDNIGHT))
		act(() => {
			window.dispatchEvent(new Event('pageshow'))
		})

		expect(result.current).toBe('2026-10-13')
	})

	it('moves on on window focus after the clock jumped', () => {
		const { result } = renderHook(() => useLocalToday(WARSAW))

		vi.setSystemTime(new Date(AFTER_MIDNIGHT))
		act(() => {
			window.dispatchEvent(new Event('focus'))
		})

		expect(result.current).toBe('2026-10-13')
	})

	it('keeps all consumers on the same day with one shared timer', () => {
		const chat = renderHook(() => useLocalToday(WARSAW))
		const today = renderHook(() => useLocalToday(WARSAW))
		const nav = renderHook(() => useLocalToday(WARSAW))
		const timersForThree = vi.getTimerCount()

		act(() => {
			vi.advanceTimersByTime(MINUTE_MS)
		})

		expect([chat, today, nav].map(({ result }) => result.current)).toEqual([
			'2026-10-13',
			'2026-10-13',
			'2026-10-13',
		])
		expect(timersForThree).toBeLessThanOrEqual(1)
	})
})
