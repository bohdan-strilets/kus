import { describe, expect, it } from 'vitest'

import { evalCaseSchema } from './case.types.js'
import { CONTEXT_PRESETS } from './context-presets.js'

const jsonCase = (contextPreset: string) => ({
	id: 'holdout-dinner',
	text: 'що на вечерю?',
	contextPreset,
	expect: { decision: 'reply', replyLang: 'uk' },
	reference: 'порада за залишком дня',
})

describe('contextPreset of a JSON case', () => {
	it('accepts a known preset', () => {
		expect(evalCaseSchema.safeParse(jsonCase('evening-1600-of-2000')).success).toBe(true)
	})

	it('rejects an unknown preset', () => {
		expect(evalCaseSchema.safeParse(jsonCase('gym-day')).success).toBe(false)
	})

	it('carries no saved foods: the loader puts the case memory there', () => {
		for (const preset of Object.values(CONTEXT_PRESETS)) {
			expect(preset).not.toHaveProperty('memory')
		}
	})

	it('keeps the remainder in line with the totals', () => {
		for (const preset of Object.values(CONTEXT_PRESETS)) {
			if (!preset.goal || !preset.dayTotals) continue
			expect(preset.goal.dailyKcal - preset.dayTotals.kcal).toBe(preset.goal.remainingKcal)
		}
	})

	it('adds the meals up to the day total', () => {
		for (const preset of Object.values(CONTEXT_PRESETS)) {
			if (!preset.meals || !preset.dayTotals) continue
			const mealsKcal = preset.meals.reduce((sum, meal) => sum + meal.kcal, 0)
			expect(mealsKcal).toBe(preset.dayTotals.kcal)
		}
	})
})
