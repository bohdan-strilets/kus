import { MAX_SET_REPS, MAX_SET_WEIGHT_KG } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { formatSetReps, formatSetWeight, stepReps, stepWeight } from './set-edit'

describe('stepWeight', () => {
	it('moves by the step in both directions', () => {
		expect(stepWeight(50, 2.5, 1)).toBe(52.5)
		expect(stepWeight(50, 2.5, -1)).toBe(47.5)
	})

	it('starts from 0 when there is no weight', () => {
		expect(stepWeight(null, 2.5, 1)).toBe(2.5)
	})

	it('never goes below 0', () => {
		expect(stepWeight(0, 2.5, -1)).toBe(0)
		expect(stepWeight(null, 2.5, -1)).toBe(0)
		expect(stepWeight(1, 2.5, -1)).toBe(0)
	})

	it('never goes above the limit', () => {
		expect(stepWeight(MAX_SET_WEIGHT_KG, 2.5, 1)).toBe(MAX_SET_WEIGHT_KG)
		expect(stepWeight(MAX_SET_WEIGHT_KG - 1, 2.5, 1)).toBe(MAX_SET_WEIGHT_KG)
	})

	it('does not drift on decimals', () => {
		expect(stepWeight(0.1, 0.2, 1)).toBe(0.3)
	})
})

describe('stepReps', () => {
	it('moves by one inside 1…max', () => {
		expect(stepReps(8, 1)).toBe(9)
		expect(stepReps(8, -1)).toBe(7)
		expect(stepReps(null, 1)).toBe(1)
	})

	it('stays inside the bounds', () => {
		expect(stepReps(1, -1)).toBe(1)
		expect(stepReps(null, -1)).toBe(1)
		expect(stepReps(MAX_SET_REPS, 1)).toBe(MAX_SET_REPS)
	})
})

describe('set value text', () => {
	it('shows a dash for an empty value', () => {
		expect(formatSetWeight(null)).toBe('—')
		expect(formatSetReps(null)).toBe('—')
	})

	it('shows integers plainly and decimals with a comma', () => {
		expect(formatSetWeight(80)).toBe('80')
		expect(formatSetWeight(77.5)).toBe('77,5')
		expect(formatSetReps(12)).toBe('12')
	})
})
