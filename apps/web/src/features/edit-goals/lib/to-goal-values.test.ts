import { describe, expect, it } from 'vitest'

import { toGoalValues } from './to-goal-values'

describe('toGoalValues', () => {
	it('maps the profile goal', () => {
		const goal = {
			kcal: 2000,
			proteinG: 150,
			carbsG: 190,
			fatG: 70,
			source: 'MANUAL' as const,
			validFrom: '2026-10-10',
			updatedAt: '2026-10-10T10:00:00.000Z',
		}
		expect(toGoalValues(goal)).toEqual({ kcal: 2000, protein: 150, carbs: 190, fat: 70 })
	})

	it('keeps the day goal and passes null through', () => {
		expect(toGoalValues({ kcal: 2200, protein: 140, carbs: 225, fat: 80 })).toEqual({
			kcal: 2200,
			protein: 140,
			carbs: 225,
			fat: 80,
		})
		expect(toGoalValues(null)).toBeNull()
	})
})
