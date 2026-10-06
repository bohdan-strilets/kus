import { describe, expect, it } from 'vitest'

import { getProgressPercent } from './get-progress-percent'

describe('getProgressPercent', () => {
	it('turns value of max into a bar width', () => {
		expect(getProgressPercent(78, 140)).toBeCloseTo(55.71, 2)
	})

	it('caps at a full bar when over the goal', () => {
		expect(getProgressPercent(160, 80)).toBe(100)
	})

	it('stays empty for a zero or negative max and negative values', () => {
		expect(getProgressPercent(10, 0)).toBe(0)
		expect(getProgressPercent(-5, 100)).toBe(0)
	})
})
