import { describe, expect, it } from 'vitest'

import { formatInteger } from './format-number'

describe('formatInteger', () => {
	it('separates thousands the Ukrainian way (no-break space)', () => {
		expect(formatInteger(1370)).toBe('1 370')
	})

	it('rounds to a whole number', () => {
		expect(formatInteger(829.6)).toBe('830')
	})
})
