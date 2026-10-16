// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePhotoLimitStore } from './photo-limit-store'
import { useIsPhotoBlocked } from './use-is-photo-blocked'

const USER_ID = '0199b3a4-0000-7000-8000-00000000000a'
const OTHER_USER_ID = '0199b3a4-0000-7000-8000-00000000000b'
const NOW = new Date('2026-10-16T12:00:00.000Z')
const MS_PER_MINUTE = 60_000

const resetsIn = (ms: number): string => new Date(NOW.getTime() + ms).toISOString()

describe('useIsPhotoBlocked', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(NOW)
		usePhotoLimitStore.setState({ ownerId: USER_ID, blockedUntil: null })
	})

	afterEach(() => {
		cleanup()
		vi.useRealTimers()
	})

	it('is false while nothing is blocked', () => {
		const { result } = renderHook(() => useIsPhotoBlocked())

		expect(result.current).toBe(false)
	})

	it('turns true as soon as the API reports the limit', () => {
		const { result } = renderHook(() => useIsPhotoBlocked())

		act(() => {
			usePhotoLimitStore.getState().block(resetsIn(10 * MS_PER_MINUTE))
		})

		expect(result.current).toBe(true)
	})

	it('turns false by itself when resetsAt comes, with no reload and no other render', () => {
		const { result } = renderHook(() => useIsPhotoBlocked())
		act(() => {
			usePhotoLimitStore.getState().block(resetsIn(10 * MS_PER_MINUTE))
		})
		expect(result.current).toBe(true)

		act(() => {
			vi.advanceTimersByTime(10 * MS_PER_MINUTE - 1)
		})
		expect(result.current).toBe(true)

		act(() => {
			vi.advanceTimersByTime(1)
		})
		expect(result.current).toBe(false)
	})

	it('is already true on the first render when the store was blocked before, and ends on time', () => {
		usePhotoLimitStore.getState().block(resetsIn(MS_PER_MINUTE))

		const { result } = renderHook(() => useIsPhotoBlocked())
		expect(result.current).toBe(true)

		act(() => {
			vi.advanceTimersByTime(MS_PER_MINUTE)
		})
		expect(result.current).toBe(false)
	})

	it('follows a longer block that replaces a shorter one', () => {
		const { result } = renderHook(() => useIsPhotoBlocked())
		act(() => {
			usePhotoLimitStore.getState().block(resetsIn(MS_PER_MINUTE))
		})
		act(() => {
			usePhotoLimitStore.getState().block(resetsIn(5 * MS_PER_MINUTE))
		})

		act(() => {
			vi.advanceTimersByTime(MS_PER_MINUTE)
		})
		expect(result.current).toBe(true)

		act(() => {
			vi.advanceTimersByTime(4 * MS_PER_MINUTE)
		})
		expect(result.current).toBe(false)
	})

	it('is false for a limit that is already over or has no usable time', () => {
		const { result } = renderHook(() => useIsPhotoBlocked())

		for (const value of [resetsIn(-MS_PER_MINUTE), undefined, 'soon', 12_345, null]) {
			act(() => {
				usePhotoLimitStore.getState().block(value)
			})
			expect(result.current).toBe(false)
		}
	})

	it('is released for another user, and after logout', () => {
		const { result } = renderHook(() => useIsPhotoBlocked())
		act(() => {
			usePhotoLimitStore.getState().block(resetsIn(10 * MS_PER_MINUTE))
		})
		expect(result.current).toBe(true)

		act(() => {
			usePhotoLimitStore.getState().claim(OTHER_USER_ID)
		})
		expect(result.current).toBe(false)

		act(() => {
			usePhotoLimitStore.getState().block(resetsIn(10 * MS_PER_MINUTE))
			usePhotoLimitStore.getState().claim(null)
		})
		expect(result.current).toBe(false)
	})

	it('leaves no timer behind once the screen is gone', () => {
		const { unmount } = renderHook(() => useIsPhotoBlocked())
		act(() => {
			usePhotoLimitStore.getState().block(resetsIn(10 * MS_PER_MINUTE))
		})
		expect(vi.getTimerCount()).toBeGreaterThan(0)

		unmount()

		expect(vi.getTimerCount()).toBe(0)
	})
})
