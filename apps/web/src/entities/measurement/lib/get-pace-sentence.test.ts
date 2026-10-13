import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { formatPaceSentence, getPaceSentenceKey, type PaceInput } from './get-pace-sentence'

const weight = (overrides: Partial<PaceInput>): PaceInput => ({
	kind: 'WEIGHT',
	weekChange: -0.5,
	planPaceKgPerWeek: 0.5,
	isAlongPlan: true,
	...overrides,
})

describe('getPaceSentenceKey', () => {
	it('has no sentence without a week to compare with', () => {
		expect(getPaceSentenceKey(weight({ weekChange: null }))).toBeNull()
	})

	it('says «without changes» for a flat week, per kind', () => {
		expect(getPaceSentenceKey(weight({ weekChange: 0 }))).toBe('measurement.pace.steady.WEIGHT')
		expect(getPaceSentenceKey(weight({ weekChange: -0.04, planPaceKgPerWeek: null }))).toBe(
			'measurement.pace.steady.WEIGHT',
		)
		expect(getPaceSentenceKey(weight({ kind: 'WAIST', weekChange: 0.02 }))).toBe(
			'measurement.pace.steady.WAIST',
		)
	})

	it('is plain without a plan pace', () => {
		expect(getPaceSentenceKey(weight({ weekChange: -0.4, planPaceKgPerWeek: null }))).toBe(
			'measurement.pace.down.plain',
		)
		expect(getPaceSentenceKey(weight({ weekChange: 0.3, planPaceKgPerWeek: null }))).toBe(
			'measurement.pace.up.plain',
		)
	})

	it.each([
		[-0.5, 'measurement.pace.down.onPlan'],
		[-0.4, 'measurement.pace.down.onPlan'],
		[-0.58, 'measurement.pace.down.onPlan'],
		[-0.7, 'measurement.pace.down.slightlyFaster'],
		[-0.9, 'measurement.pace.down.faster'],
		[-0.2, 'measurement.pace.down.slower'],
	])('compares a week of %d kg with a 0.5 plan: %s', (weekChange, key) => {
		expect(getPaceSentenceKey(weight({ weekChange }))).toBe(key)
	})

	it('compares a gaining week with the plan the same way (GAIN)', () => {
		expect(getPaceSentenceKey(weight({ weekChange: 0.9 }))).toBe('measurement.pace.up.faster')
		expect(getPaceSentenceKey(weight({ weekChange: 0.7, planPaceKgPerWeek: 0.25 }))).toBe(
			'measurement.pace.up.faster',
		)
		expect(getPaceSentenceKey(weight({ weekChange: 0.4, planPaceKgPerWeek: 0.25 }))).toBe(
			'measurement.pace.up.slightlyFaster',
		)
	})

	it('stays plain for a week against the plan: no «faster» for a gain on a loss plan', () => {
		expect(getPaceSentenceKey(weight({ weekChange: 0.9, isAlongPlan: false }))).toBe(
			'measurement.pace.up.plain',
		)
	})

	it('never compares a waist with the plan', () => {
		expect(getPaceSentenceKey(weight({ kind: 'WAIST', weekChange: -1 }))).toBe(
			'measurement.pace.down.plain',
		)
	})
})

describe('formatPaceSentence', () => {
	it('writes weight with kg and waist with cm, «за тиждень»', () => {
		expect(formatPaceSentence(i18n.t, 'measurement.pace.down.slightlyFaster', -0.7, 'WEIGHT')).toBe(
			'Мінус 0,7 кг за тиждень, трохи швидше за план — без поспіху.',
		)
		expect(formatPaceSentence(i18n.t, 'measurement.pace.up.plain', 0.3, 'WEIGHT')).toBe(
			'Плюс 0,3 кг за тиждень.',
		)
		expect(formatPaceSentence(i18n.t, 'measurement.pace.down.plain', -1, 'WAIST')).toBe(
			'Мінус 1 см за тиждень.',
		)
		expect(formatPaceSentence(i18n.t, 'measurement.pace.steady.WEIGHT', 0, 'WEIGHT')).toBe(
			'За тиждень вага майже без змін.',
		)
		expect(formatPaceSentence(i18n.t, 'measurement.pace.steady.WAIST', 0, 'WAIST')).toBe(
			'За тиждень талія майже без змін.',
		)
	})

	it('keeps «повільніше» without reproach', () => {
		expect(formatPaceSentence(i18n.t, 'measurement.pace.down.slower', -0.2, 'WEIGHT')).toBe(
			'Мінус 0,2 кг за тиждень, повільніше за план.',
		)
	})
})

describe('uk.json pace keys', () => {
	const directions = ['down', 'up'] as const
	const comparisons = ['plain', 'onPlan', 'slightlyFaster', 'faster', 'slower'] as const

	it('has a sentence with a unit slot for every direction and comparison', () => {
		for (const direction of directions) {
			for (const comparison of comparisons) {
				const key = `measurement.pace.${direction}.${comparison}` as const
				expect(i18n.exists(key), key).toBe(true)
				expect(i18n.t(key, { value: 'X' }), key).toContain('X')
			}
		}
	})

	it('has a steady sentence per kind and no leftover progress.insight.pace keys', () => {
		expect(i18n.exists('measurement.pace.steady.WEIGHT')).toBe(true)
		expect(i18n.exists('measurement.pace.steady.WAIST')).toBe(true)
		expect(i18n.exists('progress.insight.pace')).toBe(false)
	})
})
