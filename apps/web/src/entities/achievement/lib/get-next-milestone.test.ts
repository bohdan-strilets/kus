import { describe, expect, it } from 'vitest'

import { getNextStreakMilestone } from './get-next-milestone'

describe('getNextStreakMilestone', () => {
	it.each([
		[3, 7],
		[7, 14],
		[14, 30],
		[30, 60],
		[60, 100],
	])('after %i days the next mark is %i', (days, expected) => {
		expect(getNextStreakMilestone(days)).toBe(expected)
	})

	it('has no next mark after the last one', () => {
		expect(getNextStreakMilestone(100)).toBeNull()
	})
})
