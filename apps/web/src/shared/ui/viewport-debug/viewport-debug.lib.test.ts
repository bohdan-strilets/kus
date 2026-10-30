import { describe, expect, it, vi } from 'vitest'

import {
	DEBUG_STORAGE_KEY,
	formatDebugLines,
	formatDebugTime,
	resolveViewportDebugFlag,
	type ViewportDebugSnapshot,
} from './viewport-debug.lib'

const createStorage = (initial: Record<string, string> = {}) => {
	const data = new Map(Object.entries(initial))
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
		removeItem: (key: string) => void data.delete(key),
	}
}

describe('resolveViewportDebugFlag', () => {
	it('is off without the param and the session flag', () => {
		expect(resolveViewportDebugFlag('', createStorage())).toBe(false)
		expect(resolveViewportDebugFlag('?debug=other', createStorage())).toBe(false)
	})

	it('turns on with ?debug=viewport and keeps it for the session', () => {
		const storage = createStorage()
		expect(resolveViewportDebugFlag('?debug=viewport', storage)).toBe(true)
		expect(storage.getItem(DEBUG_STORAGE_KEY)).toBe('1')
		expect(resolveViewportDebugFlag('', storage)).toBe(true)
	})

	it('?debug=off clears the flag', () => {
		const storage = createStorage({ [DEBUG_STORAGE_KEY]: '1' })
		expect(resolveViewportDebugFlag('?debug=off', storage)).toBe(false)
		expect(resolveViewportDebugFlag('', storage)).toBe(false)
	})

	it('works without storage and when storage throws', () => {
		const broken = {
			getItem: vi.fn(() => {
				throw new Error('blocked')
			}),
			setItem: vi.fn(() => {
				throw new Error('blocked')
			}),
			removeItem: vi.fn(),
		}
		expect(resolveViewportDebugFlag('?debug=viewport', null)).toBe(true)
		expect(resolveViewportDebugFlag('?debug=viewport', broken)).toBe(true)
		expect(resolveViewportDebugFlag('', broken)).toBe(false)
	})
})

describe('formatDebugTime', () => {
	it('formats HH:MM:SS.mmm and a dash before the first event', () => {
		expect(formatDebugTime(null)).toBe('—')
		expect(formatDebugTime(new Date(2026, 9, 30, 7, 5, 9, 42).getTime())).toBe('07:05:09.042')
	})
})

describe('formatDebugLines', () => {
	it('rounds numbers and prints flags', () => {
		const snapshot: ViewportDebugSnapshot = {
			innerHeight: 844,
			vvHeight: 505.6,
			vvTop: 0.4,
			vvScale: 1.004,
			isFieldFocused: true,
			isNavHidden: false,
			resizeAt: null,
			resizeCount: 0,
			scrollAt: new Date(2026, 9, 30, 12, 0, 0, 5).getTime(),
			scrollCount: 3,
		}
		expect(formatDebugLines(snapshot)).toEqual([
			'innerH 844',
			'vv.h 506',
			'vv.top 0',
			'scale 1',
			'focus yes',
			'nav hidden no',
			'resize@ — #0',
			'scroll@ 12:00:00.005 #3',
		])
	})
})
