import { describe, expect, it } from 'vitest'

import { type StatsCard, statsCardSchema } from '../schemas/stats-card.js'
import { buildStatsAdviceToolResult, formatStatsAdviceNumbers } from './stats-advice.js'

const card = (patch: Partial<StatsCard> = {}): StatsCard => ({
	version: 1,
	period: 'week',
	periodDays: 7,
	from: '2026-10-30',
	to: '2026-11-05',
	loggedDays: 6,
	daysInNorm: 5,
	avgKcal: 2160,
	avgProteinG: 121,
	goalKcal: 2200,
	weightChangeKg: -0.4,
	proteinGoalG: 140,
	weightStartKg: 84,
	weightEndKg: 83.6,
	days: [],
	hasAdvice: false,
	...patch,
})

describe('formatStatsAdviceNumbers', () => {
	it('writes the counted numbers of the card, without weight', () => {
		expect(formatStatsAdviceNumbers(card())).toBe(
			'7 days 2026-10-30–2026-11-05: logged 6 of 7 days; average 2 160 kcal (goal 2 200), protein 121 g (goal 140 g); in the goal 5 of 6 logged days, over 1',
		)
	})

	it('leaves out the goals that are not set', () => {
		expect(formatStatsAdviceNumbers(card({ goalKcal: null, proteinGoalG: null }))).toBe(
			'7 days 2026-10-30–2026-11-05: logged 6 of 7 days; average 2 160 kcal, protein 121 g',
		)
	})

	it('falls back to the named period when the length is absent', () => {
		expect(formatStatsAdviceNumbers(card({ periodDays: undefined, period: 'month' }))).toContain(
			'30 days',
		)
	})
})

describe('formatStatsAdviceNumbers, partial goals and empty periods', () => {
	it('keeps the kcal goal and drops only the protein goal', () => {
		const text = formatStatsAdviceNumbers(card({ proteinGoalG: null }))
		expect(text).toContain('average 2 160 kcal (goal 2 200), protein 121 g;')
		expect(text).toContain('in the goal 5 of 6 logged days')
	})

	it('has no "in the goal" part without the kcal goal, but keeps the protein goal', () => {
		const text = formatStatsAdviceNumbers(card({ goalKcal: null }))
		expect(text).toContain('average 2 160 kcal, protein 121 g (goal 140 g)')
		expect(text).not.toContain('in the goal')
	})

	it('writes no averages for 0 logged days', () => {
		const text = formatStatsAdviceNumbers(
			card({ loggedDays: 0, daysInNorm: 0, avgKcal: null, avgProteinG: null }),
		)
		expect(text).toBe(
			'7 days 2026-10-30–2026-11-05: logged 0 of 7 days; in the goal 0 of 0 logged days, over 0',
		)
	})

	it('never mentions the weight', () => {
		expect(formatStatsAdviceNumbers(card())).not.toMatch(/weight|kg|84|83\.6/i)
	})
})

describe('buildStatsAdviceToolResult', () => {
	it('wraps the numbers into the approved template', () => {
		const result = buildStatsAdviceToolResult(card())
		expect(
			result.startsWith('Numbers of the period, already counted (count nothing yourself): 7 days'),
		).toBe(true)
		expect(result).toContain('over 1. Answer with reply only: the advice the user asked for')
	})
})

describe('statsCardSchema.hasAdvice', () => {
	it('reads an older snapshot without it as false', () => {
		const { hasAdvice: _hasAdvice, ...old } = card()
		expect(statsCardSchema.parse(old).hasAdvice).toBe(false)
	})
})
