import type { GoalsPreviewResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { getGoalWarningMessage } from './get-goal-warning-message'

const preview: GoalsPreviewResponse = {
	kcal: 1500,
	proteinG: 140,
	carbsG: 100,
	fatG: 60,
	appliedPaceKgPerWeek: 0.5,
	etaWeeks: null,
	warnings: [],
	steps: { bmr: 1800, activityMultiplier: 1.2, tdee: 2160, adjustmentKcal: -550, rawKcal: 1610 },
	current: null,
}

describe('getGoalWarningMessage', () => {
	it('names the floor in kcal', () => {
		const { key, params } = getGoalWarningMessage('KCAL_FLOOR_APPLIED', preview)

		expect(key).toBe('recalcGoals.warnings.KCAL_FLOOR_APPLIED')
		expect(params).toEqual({ kcal: '1 500' })
	})

	it('gives the pace that was applied, without a sign', () => {
		const { key, params } = getGoalWarningMessage('PACE_LIMITED', preview)

		expect(key).toBe('recalcGoals.warnings.PACE_LIMITED')
		expect(params).toEqual({ pace: '0,5' })
	})

	it('needs no params for adjusted macros', () => {
		const message = getGoalWarningMessage('MACROS_ADJUSTED', preview)

		expect(message).toEqual({ key: 'recalcGoals.warnings.MACROS_ADJUSTED' })
	})
})
