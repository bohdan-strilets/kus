import { describe, expect, it } from 'vitest'

import { getMemoryTab } from './get-memory-tab'

describe('getMemoryTab', () => {
	it('opens «Про тебе» for tab=facts', () => {
		expect(getMemoryTab('facts')).toBe('facts')
	})

	it.each([null, '', 'products', 'Facts', 'workouts'])('opens «Продукти» for %s', (param) => {
		expect(getMemoryTab(param)).toBe('products')
	})
})
