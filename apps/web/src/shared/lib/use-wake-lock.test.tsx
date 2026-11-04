// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWakeLock } from './use-wake-lock'

interface FakeSentinel {
	released: boolean
	release: ReturnType<typeof vi.fn>
}

const makeSentinel = (): FakeSentinel => {
	const sentinel: FakeSentinel = {
		released: false,
		release: vi.fn(() => {
			sentinel.released = true
			return Promise.resolve()
		}),
	}
	return sentinel
}

let visibility: DocumentVisibilityState = 'visible'
const request = vi.fn()

const installApi = (): void => {
	Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
}

const flush = async (): Promise<void> => {
	await act(async () => {
		await Promise.resolve()
	})
}

const changeVisibility = async (state: DocumentVisibilityState): Promise<void> => {
	visibility = state
	document.dispatchEvent(new Event('visibilitychange'))
	await flush()
}

beforeEach(() => {
	visibility = 'visible'
	Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
	request.mockImplementation(() => Promise.resolve(makeSentinel()))
	installApi()
})

afterEach(() => {
	cleanup()
	Reflect.deleteProperty(navigator, 'wakeLock')
	request.mockReset()
})

describe('useWakeLock', () => {
	it('no API: unavailable while active, nothing requested', () => {
		Reflect.deleteProperty(navigator, 'wakeLock')

		const { result } = renderHook(() => useWakeLock(true))

		expect(result.current.isUnavailable).toBe(true)
		expect(request).not.toHaveBeenCalled()
	})

	it('no API but not active: not unavailable (no hint needed)', () => {
		Reflect.deleteProperty(navigator, 'wakeLock')

		const { result } = renderHook(() => useWakeLock(false))

		expect(result.current.isUnavailable).toBe(false)
	})

	it('a refused request makes it unavailable', async () => {
		request.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))

		const { result } = renderHook(() => useWakeLock(true))
		await flush()

		expect(result.current.isUnavailable).toBe(true)
	})

	it('success: asks for the screen lock once and stays available', async () => {
		const { result } = renderHook(() => useWakeLock(true))
		await flush()

		expect(request).toHaveBeenCalledTimes(1)
		expect(request).toHaveBeenCalledWith('screen')
		expect(result.current.isUnavailable).toBe(false)
	})

	it('does not ask again while the lock is held (visibilitychange to visible)', async () => {
		renderHook(() => useWakeLock(true))
		await flush()

		await changeVisibility('visible')

		expect(request).toHaveBeenCalledTimes(1)
	})

	it('asks again after the browser dropped the lock and the page is visible again', async () => {
		const first = makeSentinel()
		request.mockResolvedValueOnce(first)
		renderHook(() => useWakeLock(true))
		await flush()

		first.released = true
		await changeVisibility('hidden')
		expect(request).toHaveBeenCalledTimes(1)
		await changeVisibility('visible')

		expect(request).toHaveBeenCalledTimes(2)
	})

	it('a refusal is cleared by a later success', async () => {
		request.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
		const { result } = renderHook(() => useWakeLock(true))
		await flush()
		expect(result.current.isUnavailable).toBe(true)

		await changeVisibility('visible')

		expect(result.current.isUnavailable).toBe(false)
	})

	it('releases the lock on unmount', async () => {
		const sentinel = makeSentinel()
		request.mockResolvedValueOnce(sentinel)
		const { unmount } = renderHook(() => useWakeLock(true))
		await flush()

		unmount()

		expect(sentinel.release).toHaveBeenCalledTimes(1)
	})

	it('releases the lock when isActive turns false, and does not ask while inactive', async () => {
		const sentinel = makeSentinel()
		request.mockResolvedValueOnce(sentinel)
		const { rerender, result } = renderHook(({ active }) => useWakeLock(active), {
			initialProps: { active: true },
		})
		await flush()

		rerender({ active: false })
		await changeVisibility('visible')

		expect(sentinel.release).toHaveBeenCalledTimes(1)
		expect(request).toHaveBeenCalledTimes(1)
		expect(result.current.isUnavailable).toBe(false)
	})

	it('isActive=false from the start never asks, even on visibilitychange', async () => {
		renderHook(() => useWakeLock(false))

		await changeVisibility('visible')

		expect(request).not.toHaveBeenCalled()
	})

	it('a lock that arrives after unmount is released at once', async () => {
		const sentinel = makeSentinel()
		let resolve: (value: FakeSentinel) => void = () => undefined
		request.mockReturnValueOnce(new Promise<FakeSentinel>((r) => (resolve = r)))
		const { unmount } = renderHook(() => useWakeLock(true))

		unmount()
		resolve(sentinel)
		await flush()

		expect(sentinel.release).toHaveBeenCalledTimes(1)
	})

	it('hidden page: does not ask', async () => {
		visibility = 'hidden'

		renderHook(() => useWakeLock(true))
		await flush()

		expect(request).not.toHaveBeenCalled()
	})
})
