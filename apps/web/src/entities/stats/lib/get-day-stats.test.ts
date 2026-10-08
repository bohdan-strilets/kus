import { describe, expect, it } from 'vitest'

import { getDayStats } from './get-day-stats'

const totals = { kcal: 1370, protein: 78, carbs: 160, fat: 48, fiber: 12 }

describe('getDayStats', () => {
	it('pairs eaten with the goal, macros in the Б → В → Ж set', () => {
		const stats = getDayStats({ totals, goal: { kcal: 2200, protein: 140, carbs: 225, fat: 80 } })
		expect(stats).toEqual({
			eaten: 1370,
			goal: 2200,
			macros: {
				protein: { value: 78, goal: 140 },
				carbs: { value: 160, goal: 225 },
				fat: { value: 48, goal: 80 },
			},
		})
	})

	it('keeps only what was eaten without a goal', () => {
		const stats = getDayStats({ totals, goal: null })
		expect(stats.goal).toBeNull()
		expect(stats.macros.protein).toEqual({ value: 78, goal: null })
	})
})
