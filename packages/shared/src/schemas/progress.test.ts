import { describe, expect, it } from 'vitest'

import { progressWaistSchema, progressWeightSchema } from './progress.js'

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

describe('progressWaistSchema', () => {
	const waist = {
		current: { value: 99, localDate: '2026-10-25' },
		changeInRange: null,
		points: [],
	}

	it('reads an answer of an older API as without a start and a change since', () => {
		expect(progressWaistSchema.parse(waist)).toMatchObject({
			start: null,
			fromStart: null,
			changeSince: null,
		})
		expect(progressWeightSchema.parse({ ...weight, changeInRange: null })).toMatchObject({
			changeSince: null,
		})
	})

	it('keeps the start, the change from it and the change since', () => {
		const parsed = progressWaistSchema.parse({
			...waist,
			start: { value: 102, localDate: '2026-10-09' },
			fromStart: -3,
			changeSince: { change: -3, sinceDate: '2026-10-09' },
		})

		expect(parsed).toMatchObject({
			start: { value: 102, localDate: '2026-10-09' },
			fromStart: -3,
			changeSince: { change: -3, sinceDate: '2026-10-09' },
		})
	})
})
