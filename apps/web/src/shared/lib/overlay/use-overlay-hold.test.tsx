// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OVERLAY_HOLD_MAX_MS, useIsOverlayOpen, useOverlayHold, useSettleHold } from './index'
import { useOverlayStore } from './overlay-store'

const deferred = () => {
	let resolve: () => void = () => undefined
	const promise = new Promise<void>((done) => {
		resolve = done
	})
	return { promise, resolve }
}

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
	useOverlayStore.setState({ count: 0 })
})

describe('useOverlayHold', () => {
	it('is an overlay while active and lets go when it ends', () => {
		const { result, rerender } = renderHook(
			({ isActive }) => {
				useOverlayHold(isActive)
				return useIsOverlayOpen()
			},
			{ initialProps: { isActive: true } },
		)
		expect(result.current).toBe(true)

		rerender({ isActive: false })
		expect(result.current).toBe(false)
	})

	it('lets go after OVERLAY_HOLD_MAX_MS if the activity never ends', () => {
		const { result } = renderHook(() => {
			useOverlayHold(true)
			return useIsOverlayOpen()
		})

		act(() => {
			vi.advanceTimersByTime(OVERLAY_HOLD_MAX_MS - 1)
		})
		expect(result.current).toBe(true)

		act(() => {
			vi.advanceTimersByTime(1)
		})
		expect(result.current).toBe(false)
	})
})

describe('useSettleHold', () => {
	it('holds until the tracked refetch resolves', async () => {
		const refetch = deferred()
		const { result } = renderHook(() => ({ hold: useSettleHold(), isOpen: useIsOverlayOpen() }))
		expect(result.current.isOpen).toBe(false)

		let tracked: Promise<void> = Promise.resolve()
		act(() => {
			tracked = result.current.hold.track(refetch.promise)
		})
		expect(result.current.hold.isSettling).toBe(true)
		expect(result.current.isOpen).toBe(true)

		await act(async () => {
			refetch.resolve()
			await tracked
		})
		expect(result.current.hold.isSettling).toBe(false)
		expect(result.current.isOpen).toBe(false)
	})

	it('drops the hold after OVERLAY_HOLD_MAX_MS when the refetch hangs', () => {
		const { result } = renderHook(() => ({ hold: useSettleHold(), isOpen: useIsOverlayOpen() }))

		act(() => {
			void result.current.hold.track(deferred().promise)
		})
		act(() => {
			vi.advanceTimersByTime(OVERLAY_HOLD_MAX_MS)
		})

		expect(result.current.isOpen).toBe(false)
	})

	it('holds while the request is busy and drops with it', () => {
		const { result, rerender } = renderHook(
			({ isBusy }) => ({ hold: useSettleHold(isBusy), isOpen: useIsOverlayOpen() }),
			{ initialProps: { isBusy: true } },
		)
		expect(result.current.isOpen).toBe(true)

		rerender({ isBusy: false })
		expect(result.current.isOpen).toBe(false)
	})

	it('still resolves with the value of the task', async () => {
		const { result } = renderHook(() => useSettleHold())

		let value = 0
		await act(async () => {
			value = await result.current.track(Promise.resolve(7))
		})

		expect(value).toBe(7)
	})
})
