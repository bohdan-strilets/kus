import type { StatsCard } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { getStatsBars, STATS_BARS_GOAL_PX } from './get-stats-bars'

// 2026-10-26 is a Monday
const card = (from: string, to: string, overrides: Partial<StatsCard> = {}): StatsCard => ({
	version: 1,
	period: 'week',
	from,
	to,
	loggedDays: 3,
	daysInNorm: 2,
	avgKcal: 2000,
	avgProteinG: 100,
	goalKcal: 2000,
	weightChangeKg: null,
	proteinGoalG: null,
	weightStartKg: null,
	weightEndKg: null,
	days: [],
	...overrides,
})

const addDays = (date: string, count: number): string =>
	new Date(Date.parse(`${date}T00:00:00Z`) + count * 86_400_000).toISOString().slice(0, 10)

describe('getStatsBars modes and widths', () => {
	it.each([
		[2, 'labeled', 'wide'],
		[7, 'labeled', 'wide'],
		[8, 'daily', 'medium'],
		[15, 'daily', 'medium'],
		[16, 'daily', 'narrow'],
		[31, 'daily', 'narrow'],
	] as const)('%d days: %s bars, %s', (total, mode, width) => {
		const result = getStatsBars(card('2026-09-01', addDays('2026-09-01', total - 1)))

		expect(result.mode).toBe(mode)
		expect(result.width).toBe(width)
		expect(result.bars).toHaveLength(total)
	})

	it('32 days: weekly bars, a week cut by the edge is partial', () => {
		// Tue 2026-09-01 .. Fri 2026-10-02: partial first and last week, 4 full weeks between
		const result = getStatsBars(card('2026-09-01', '2026-10-02'))

		expect(result.mode).toBe('weekly')
		expect(result.bars.map(({ date }) => date)).toEqual([
			'2026-09-01',
			'2026-09-07',
			'2026-09-14',
			'2026-09-21',
			'2026-09-28',
		])
		expect(result.bars.map(({ isPartial }) => isPartial)).toEqual([true, false, false, false, true])
	})

	it('92 days: still weekly, narrower bars among many weeks', () => {
		const result = getStatsBars(card('2026-07-27', '2026-10-26'))

		expect(result.mode).toBe('weekly')
		expect(result.width).toBe('medium')
		expect(result.bars.length).toBeGreaterThan(9)
	})

	it('a full Monday–Sunday run has no partial weeks', () => {
		const result = getStatsBars(card('2026-09-14', '2026-10-18'))

		expect(result.bars).toHaveLength(5)
		expect(result.bars.every(({ isPartial }) => !isPartial)).toBe(true)
	})
})

describe('getStatsBars heights', () => {
	it('a day at the goal is goal-high, over the goal adds the over part, no entries is empty', () => {
		const result = getStatsBars(
			card('2026-10-20', '2026-10-22', {
				days: [
					{ date: '2026-10-20', kcal: 2000, verdict: 'on_goal' },
					{ date: '2026-10-21', kcal: 2400, verdict: 'over' },
				],
			}),
		)

		expect(result.hasGoalLine).toBe(true)
		expect(result.bars[0]).toMatchObject({ heightPx: STATS_BARS_GOAL_PX, overPx: 0 })
		expect(result.bars[1]?.overPx).toBeGreaterThan(0)
		expect(result.bars[2]).toMatchObject({ heightPx: 0, overPx: 0 })
	})

	it('without a goal: no line, no over part, the tallest day sets the scale', () => {
		const result = getStatsBars(
			card('2026-10-20', '2026-10-21', {
				goalKcal: null,
				days: [
					{ date: '2026-10-20', kcal: 1000, verdict: 'no_goal' },
					{ date: '2026-10-21', kcal: 3000, verdict: 'no_goal' },
				],
			}),
		)

		expect(result.hasGoalLine).toBe(false)
		expect(result.bars.map(({ overPx }) => overPx)).toEqual([0, 0])
		expect(result.bars[1]?.heightPx).toBe(STATS_BARS_GOAL_PX)
	})

	it('a weekly bar is the mean of the days with entries, not of all seven', () => {
		const result = getStatsBars(
			card('2026-09-14', '2026-10-18', {
				days: [
					{ date: '2026-09-14', kcal: 1800, verdict: 'on_goal' },
					{ date: '2026-09-15', kcal: 2200, verdict: 'on_goal' },
				],
			}),
		)

		expect(result.bars[0]?.heightPx).toBe(STATS_BARS_GOAL_PX)
		expect(result.bars[1]?.heightPx).toBe(0)
	})
})
