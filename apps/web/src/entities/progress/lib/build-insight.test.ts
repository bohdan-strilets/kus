import type { ProgressInsight } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { buildInsight, getInsightKeys } from './build-insight'

const facts = (overrides: Partial<ProgressInsight> = {}): ProgressInsight => ({
	weekPaceKg: null,
	planPaceKgPerWeek: null,
	goalType: null,
	overDays: 0,
	isWeekendProteinLow: false,
	...overrides,
})

describe('getInsightKeys', () => {
	it('says nothing when there are no facts', () => {
		expect(getInsightKeys(facts())).toEqual([])
	})

	it('speaks of the pace only when the week has one', () => {
		expect(getInsightKeys(facts({ overDays: 1 })).map((part) => part.key)).toEqual([
			'progress.insight.overDays',
		])
	})

	it('compares the pace with the plan when the week moves the way the goal points', () => {
		const lose = (weekPaceKg: number) =>
			getInsightKeys(facts({ weekPaceKg, planPaceKgPerWeek: 0.5, goalType: 'LOSE' }))[0]?.key

		expect(lose(-0.5)).toBe('progress.insight.pace.down.onPlan')
		expect(lose(-0.58)).toBe('progress.insight.pace.down.onPlan')
		expect(lose(-0.9)).toBe('progress.insight.pace.down.faster')
		expect(lose(-0.2)).toBe('progress.insight.pace.down.slower')
	})

	it('compares a gain with the plan of a gain goal', () => {
		const [part] = getInsightKeys(
			facts({ weekPaceKg: 0.4, planPaceKgPerWeek: 0.25, goalType: 'GAIN' }),
		)

		expect(part?.key).toBe('progress.insight.pace.up.faster')
	})

	it('keeps the pace plain against the goal, without a plan or without a direction', () => {
		const key = (insight: Partial<ProgressInsight>) => getInsightKeys(facts(insight))[0]?.key

		expect(key({ weekPaceKg: 0.3, planPaceKgPerWeek: 0.5, goalType: 'LOSE' })).toBe(
			'progress.insight.pace.up.plain',
		)
		expect(key({ weekPaceKg: -0.3, planPaceKgPerWeek: null, goalType: 'LOSE' })).toBe(
			'progress.insight.pace.down.plain',
		)
		expect(key({ weekPaceKg: -0.3, planPaceKgPerWeek: 0.5, goalType: 'MAINTAIN' })).toBe(
			'progress.insight.pace.down.plain',
		)
		expect(key({ weekPaceKg: -0.3, planPaceKgPerWeek: 0.5, goalType: null })).toBe(
			'progress.insight.pace.down.plain',
		)
	})

	it('calls a week under half a hundred grams steady', () => {
		expect(getInsightKeys(facts({ weekPaceKg: 0.03 }))[0]?.key).toBe('progress.insight.pace.steady')
	})

	it('adds over days and the weekend protein, at most three sentences', () => {
		const parts = getInsightKeys(
			facts({ weekPaceKg: -0.4, overDays: 2, isWeekendProteinLow: true }),
		)

		expect(parts).toHaveLength(3)
		expect(parts.map((part) => part.key)).toEqual([
			'progress.insight.pace.down.plain',
			'progress.insight.overDays',
			'progress.insight.weekendProtein',
		])
	})
})

describe('buildInsight', () => {
	it('is empty for no facts', () => {
		expect(buildInsight(facts(), i18n.t)).toEqual([])
	})

	it('writes the sentences with the backend numbers and the Ukrainian plural', () => {
		const sentences = buildInsight(
			facts({
				weekPaceKg: -0.3,
				planPaceKgPerWeek: 0.5,
				goalType: 'LOSE',
				overDays: 2,
				isWeekendProteinLow: true,
			}),
			i18n.t,
		)

		expect(sentences).toEqual([
			'Мінус 0,3 кг на тиждень — повільніше, ніж у плані.',
			'За тиждень понад ціль калорій: 2 дні.',
			'У вихідні білок просідає.',
		])
	})

	it('inflects the days and signs a gain', () => {
		const one = buildInsight(facts({ overDays: 1 }), i18n.t)
		const five = buildInsight(facts({ overDays: 5 }), i18n.t)
		const gain = buildInsight(facts({ weekPaceKg: 0.3 }), i18n.t)

		expect(one).toEqual(['За тиждень понад ціль калорій: 1 день.'])
		expect(five).toEqual(['За тиждень понад ціль калорій: 5 днів.'])
		expect(gain).toEqual(['Плюс 0,3 кг на тиждень.'])
	})

	it('adds «без поспіху» to a pace faster than the plan', () => {
		const down = buildInsight(
			facts({ weekPaceKg: -0.9, planPaceKgPerWeek: 0.5, goalType: 'LOSE' }),
			i18n.t,
		)
		const up = buildInsight(
			facts({ weekPaceKg: 0.9, planPaceKgPerWeek: 0.5, goalType: 'GAIN' }),
			i18n.t,
		)

		expect(down).toEqual(['Мінус 0,9 кг на тиждень — швидше, ніж у плані, без поспіху.'])
		expect(up).toEqual(['Плюс 0,9 кг на тиждень — швидше, ніж у плані, без поспіху.'])
	})
})
