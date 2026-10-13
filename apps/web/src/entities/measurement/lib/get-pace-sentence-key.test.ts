import { describe, expect, it } from 'vitest'

import { getPaceSentenceKey } from './get-pace-sentence-key'

describe('getPaceSentenceKey', () => {
	it('has no sentence without a week to compare with', () => {
		expect(
			getPaceSentenceKey({ weekChange: null, planPaceKgPerWeek: 0.5, fromStart: -1 }),
		).toBeNull()
	})

	it('says «without changes» for a flat week', () => {
		expect(getPaceSentenceKey({ weekChange: 0, planPaceKgPerWeek: 0.5, fromStart: -1 })).toBe(
			'measurement.pace.steady',
		)
		expect(getPaceSentenceKey({ weekChange: -0.04, planPaceKgPerWeek: null, fromStart: -1 })).toBe(
			'measurement.pace.steady',
		)
	})

	it('is plain without a plan pace', () => {
		expect(getPaceSentenceKey({ weekChange: -0.4, planPaceKgPerWeek: null, fromStart: -1.6 })).toBe(
			'measurement.pace.down.plain',
		)
		expect(getPaceSentenceKey({ weekChange: 0.3, planPaceKgPerWeek: null, fromStart: 1 })).toBe(
			'measurement.pace.up.plain',
		)
	})

	it.each([
		[-0.5, 'measurement.pace.down.onPlan'],
		[-0.4, 'measurement.pace.down.onPlan'],
		[-0.7, 'measurement.pace.down.slightlyFaster'],
		[-0.9, 'measurement.pace.down.faster'],
		[-0.2, 'measurement.pace.down.slower'],
	])('compares a week of %d kg with a 0.5 plan: %s', (weekChange, key) => {
		expect(getPaceSentenceKey({ weekChange, planPaceKgPerWeek: 0.5, fromStart: -2 })).toBe(key)
	})

	it('compares a gaining week with the plan the same way', () => {
		expect(getPaceSentenceKey({ weekChange: 0.9, planPaceKgPerWeek: 0.5, fromStart: 2 })).toBe(
			'measurement.pace.up.faster',
		)
	})

	it('stays neutral for a week against the overall trend: no «faster» for a gain on a loss plan', () => {
		expect(getPaceSentenceKey({ weekChange: 0.9, planPaceKgPerWeek: 0.5, fromStart: -2 })).toBe(
			'measurement.pace.up.plain',
		)
	})

	it('stays neutral without a start to read the trend from', () => {
		expect(getPaceSentenceKey({ weekChange: -0.5, planPaceKgPerWeek: 0.5, fromStart: null })).toBe(
			'measurement.pace.down.plain',
		)
	})
})
