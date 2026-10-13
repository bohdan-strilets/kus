import type { AchievementResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { pickAchievement } from './pick-achievement'

const create = (type: AchievementResponse['type'], value: number): AchievementResponse => ({
	id: `${type}-${value}`,
	type,
	value,
	achievedAt: '2026-10-12T10:00:00.000Z',
})

describe('pickAchievement', () => {
	it('shows nothing without achievements', () => {
		expect(pickAchievement([])).toBeNull()
	})

	it('shows the streak card when only the streak is there', () => {
		const streak = create('FOOD_STREAK', 7)

		expect(pickAchievement([streak])).toBe(streak)
	})

	it('shows the kilograms card when only kilograms are there', () => {
		const kg = create('WEIGHT_KG_LOST', 2)

		expect(pickAchievement([kg])).toBe(kg)
	})

	it('shows the kilograms card and keeps the streak silent when both are there', () => {
		const kg = create('WEIGHT_KG_LOST', 3)

		expect(pickAchievement([create('FOOD_STREAK', 14), kg])).toBe(kg)
	})

	it('takes the biggest value within one type', () => {
		const biggest = create('WEIGHT_KG_LOST', 3)

		expect(
			pickAchievement([create('WEIGHT_KG_LOST', 1), biggest, create('WEIGHT_KG_LOST', 2)]),
		).toBe(biggest)
	})
})
