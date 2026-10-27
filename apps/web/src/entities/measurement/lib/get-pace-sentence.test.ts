import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { formatPaceSentence, getPaceSentenceKey, type PaceSentenceKey } from './get-pace-sentence'

const FORBIDDEN_WORDS = /план|швидше|повільніше|поспіх/i

describe('getPaceSentenceKey', () => {
	it('has no sentence without a week to compare with', () => {
		expect(getPaceSentenceKey({ kind: 'WEIGHT', weekChange: null })).toBeNull()
	})

	it('says «without changes» for a flat week, per kind', () => {
		expect(getPaceSentenceKey({ kind: 'WEIGHT', weekChange: 0 })).toBe(
			'measurement.pace.steady.WEIGHT',
		)
		expect(getPaceSentenceKey({ kind: 'WEIGHT', weekChange: -0.04 })).toBe(
			'measurement.pace.steady.WEIGHT',
		)
		expect(getPaceSentenceKey({ kind: 'WAIST', weekChange: 0.02 })).toBe(
			'measurement.pace.steady.WAIST',
		)
	})

	it.each([-0.2, -0.5, -0.9, -3])('is a plain «down» fact for %d kg', (weekChange) => {
		expect(getPaceSentenceKey({ kind: 'WEIGHT', weekChange })).toBe('measurement.pace.down.plain')
	})

	it.each([0.3, 0.9])('is a plain «up» fact for %d kg', (weekChange) => {
		expect(getPaceSentenceKey({ kind: 'WEIGHT', weekChange })).toBe('measurement.pace.up.plain')
	})

	it('treats a waist the same way', () => {
		expect(getPaceSentenceKey({ kind: 'WAIST', weekChange: -1 })).toBe(
			'measurement.pace.down.plain',
		)
	})
})

describe('formatPaceSentence', () => {
	it('writes weight with kg and waist with cm, «за тиждень»', () => {
		expect(formatPaceSentence(i18n.t, 'measurement.pace.down.plain', -0.4, 'WEIGHT')).toBe(
			'Мінус 0,4 кг за тиждень.',
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

	it('never mentions the plan, speed or hurry', () => {
		const keys: PaceSentenceKey[] = [
			'measurement.pace.down.plain',
			'measurement.pace.up.plain',
			'measurement.pace.steady.WEIGHT',
			'measurement.pace.steady.WAIST',
		]
		for (const key of keys) {
			expect(formatPaceSentence(i18n.t, key, 0.7, 'WEIGHT'), key).not.toMatch(FORBIDDEN_WORDS)
		}
	})
})

describe('uk.json pace keys', () => {
	it('has a sentence with a unit slot for each direction and no plan comparisons left', () => {
		for (const direction of ['down', 'up'] as const) {
			const key = `measurement.pace.${direction}.plain` as const
			expect(i18n.t(key, { value: 'X' }), key).toContain('X')
			for (const leftover of ['onPlan', 'slightlyFaster', 'faster', 'slower']) {
				expect(i18n.exists(`measurement.pace.${direction}.${leftover}`)).toBe(false)
			}
		}
	})

	it('has a steady sentence per kind and no leftover progress.insight.pace keys', () => {
		expect(i18n.exists('measurement.pace.steady.WEIGHT')).toBe(true)
		expect(i18n.exists('measurement.pace.steady.WAIST')).toBe(true)
		expect(i18n.exists('progress.insight.pace')).toBe(false)
	})
})
