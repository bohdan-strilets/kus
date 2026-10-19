import { describe, expect, it } from 'vitest'

import { getDayRelation } from './get-day-relation'

const TODAY = '2026-10-18'

describe('getDayRelation', () => {
	it.each([
		['2026-10-18', 'today'],
		['2026-10-19', 'tomorrow'],
		['2026-10-17', 'yesterday'],
		['2026-10-16', 'other'],
		['2026-10-20', 'other'],
	] as const)('%s is %s', (localDate, expected) => {
		expect(getDayRelation(localDate, TODAY)).toBe(expected)
	})

	it('crosses a month border', () => {
		expect(getDayRelation('2026-11-01', '2026-10-31')).toBe('tomorrow')
		expect(getDayRelation('2026-09-30', '2026-10-01')).toBe('yesterday')
	})
})
