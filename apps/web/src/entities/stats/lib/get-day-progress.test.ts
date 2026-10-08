import { describe, expect, it } from 'vitest'

import { getDayProgress } from './get-day-progress'

describe('getDayProgress', () => {
	it('is the share of the goal, past 1 when over', () => {
		expect(getDayProgress({ eaten: 1100, goal: 2200 })).toBe(0.5)
		expect(getDayProgress({ eaten: 2640, goal: 2200 })).toBeCloseTo(1.2)
	})

	it('stays empty without a goal', () => {
		expect(getDayProgress({ eaten: 1712, goal: null })).toBe(0)
	})
})
