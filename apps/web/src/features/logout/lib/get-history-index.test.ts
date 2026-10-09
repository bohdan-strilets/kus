import { describe, expect, it } from 'vitest'

import { getHistoryIndex } from './get-history-index'

describe('getHistoryIndex', () => {
	it('reads how far into the app history we are', () => {
		expect(getHistoryIndex({ usr: null, key: 'a1', idx: 3 })).toBe(3)
	})

	it('treats the first entry and anything unexpected as 0', () => {
		expect(getHistoryIndex({ idx: 0 })).toBe(0)
		expect(getHistoryIndex({ idx: -2 })).toBe(0)
		expect(getHistoryIndex({ idx: '3' })).toBe(0)
		expect(getHistoryIndex({ idx: 1.5 })).toBe(0)
		expect(getHistoryIndex(null)).toBe(0)
		expect(getHistoryIndex('state')).toBe(0)
	})
})
