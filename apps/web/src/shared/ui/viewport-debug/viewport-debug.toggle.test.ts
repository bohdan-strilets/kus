// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import {
	DEBUG_STORAGE_KEY,
	DEBUG_TAPS_WINDOW_MS,
	DEBUG_TOGGLE_EVENT,
	registerDebugTap,
	toggleViewportDebug,
} from './viewport-debug.lib'

const createStorage = (initial: Record<string, string> = {}) => {
	const data = new Map(Object.entries(initial))
	return {
		data,
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value)
		},
		removeItem: (key: string) => {
			data.delete(key)
		},
	}
}

const tapTimes = (times: number[]) =>
	times.reduce<{ taps: number[]; toggles: number }>(
		(state, now) => {
			const next = registerDebugTap(state.taps, now)
			return { taps: next.taps, toggles: state.toggles + (next.isToggle ? 1 : 0) }
		},
		{ taps: [], toggles: 0 },
	)

describe('registerDebugTap', () => {
	it('toggles on the fifth quick tap and starts counting again', () => {
		expect(tapTimes([0, 300, 600, 900]).toggles).toBe(0)
		expect(tapTimes([0, 300, 600, 900, 1200]).toggles).toBe(1)
		expect(tapTimes([0, 300, 600, 900, 1200]).taps).toEqual([])
	})

	it('forgets taps older than the window', () => {
		const late = DEBUG_TAPS_WINDOW_MS + 100

		expect(tapTimes([0, 300, 600, 900, late]).toggles).toBe(0)
	})
})

describe('toggleViewportDebug', () => {
	it('stores the flag, tells the overlay and turns it off on the next toggle', () => {
		const storage = createStorage()
		const listener = vi.fn()
		window.addEventListener(DEBUG_TOGGLE_EVENT, listener)

		expect(toggleViewportDebug(storage)).toBe(true)
		expect(storage.data.get(DEBUG_STORAGE_KEY)).toBe('1')
		expect(toggleViewportDebug(storage)).toBe(false)
		expect(storage.data.has(DEBUG_STORAGE_KEY)).toBe(false)

		const details = listener.mock.calls.map(([event]) => (event as CustomEvent<boolean>).detail)
		expect(details).toEqual([true, false])
		window.removeEventListener(DEBUG_TOGGLE_EVENT, listener)
	})

	it('stays off when the storage throws', () => {
		const storage = {
			getItem: () => {
				throw new Error('blocked')
			},
			setItem: vi.fn(),
			removeItem: vi.fn(),
		}

		expect(toggleViewportDebug(storage)).toBe(false)
	})
})
