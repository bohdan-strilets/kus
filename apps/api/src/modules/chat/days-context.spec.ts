import { describe, expect, it } from 'vitest'

import { buildDaysContext } from './days-context'

const TODAY = '2026-10-18'

describe('buildDaysContext', () => {
	it('lists today − 3 … today + 1 with labels and zeros for empty days', () => {
		const days = buildDaysContext({
			today: TODAY,
			totalsByDay: new Map(),
			goalKcalByDay: new Map(),
		})

		expect(days.map(({ localDate, label }) => [localDate, label])).toEqual([
			['2026-10-15', null],
			['2026-10-16', null],
			['2026-10-17', 'yesterday'],
			['2026-10-18', 'today'],
			['2026-10-19', 'tomorrow'],
		])
		expect(
			days.every(
				({ kcal, entryCount, overKcal }) => kcal === 0 && entryCount === 0 && overKcal === null,
			),
		).toBe(true)
	})

	it('counts the overshoot of past days only, against the goal of that day', () => {
		const days = buildDaysContext({
			today: TODAY,
			totalsByDay: new Map([
				['2026-10-16', { kcal: 2300.4, entryCount: 5 }],
				['2026-10-17', { kcal: 1900, entryCount: 4 }],
				['2026-10-18', { kcal: 2600, entryCount: 3 }],
				['2026-10-19', { kcal: 2600, entryCount: 2 }],
			]),
			goalKcalByDay: new Map([
				['2026-10-16', 2000],
				['2026-10-17', 2000],
				['2026-10-18', 2000],
				['2026-10-19', 2000],
			]),
		})

		expect(days.map(({ localDate, overKcal }) => [localDate, overKcal])).toEqual([
			['2026-10-15', null],
			['2026-10-16', 300.4],
			['2026-10-17', null],
			['2026-10-18', null],
			['2026-10-19', null],
		])
	})

	it('has no overshoot without a goal', () => {
		const days = buildDaysContext({
			today: TODAY,
			totalsByDay: new Map([['2026-10-17', { kcal: 5000, entryCount: 1 }]]),
			goalKcalByDay: new Map([['2026-10-17', null]]),
		})

		expect(days.find(({ localDate }) => localDate === '2026-10-17')?.overKcal).toBeNull()
	})
})
