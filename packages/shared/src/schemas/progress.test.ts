import { describe, expect, it } from 'vitest'

import { progressWeightSchema } from './progress.js'

const weight = {
	current: { value: 82.4, localDate: '2026-10-12' },
	changeInRange: null,
	points: [],
	target: null,
	toGoal: null,
	isGoalReached: null,
}

describe('progressWeightSchema', () => {
	it('reads an answer of an older API as without a start', () => {
		expect(progressWeightSchema.parse(weight)).toMatchObject({ start: null, fromStart: null })
	})

	it('keeps the start and the change from it', () => {
		const parsed = progressWeightSchema.parse({
			...weight,
			start: { value: 85, localDate: '2026-08-28' },
			fromStart: -2.6,
		})

		expect(parsed).toMatchObject({ start: { value: 85, localDate: '2026-08-28' }, fromStart: -2.6 })
	})
})
