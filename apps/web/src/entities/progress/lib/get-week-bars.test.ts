import { describe, expect, it } from 'vitest'

import { makeProgress } from '@/shared/testing'

import { getWeekBars, getWeekChartSummary } from './get-week-bars'

const { days } = makeProgress().week
const TODAY = '2026-10-12'

describe('getWeekBars', () => {
	it('draws seven bars and marks only today', () => {
		const { bars } = getWeekBars({ days, goalKcal: 2200, today: TODAY })

		expect(bars).toHaveLength(7)
		expect(bars.filter((bar) => bar.isToday).map((bar) => bar.localDate)).toEqual([TODAY])
	})

	it('puts the tallest day at the top of the plot and the goal line below it', () => {
		const { bars, goalY, maxIndex } = getWeekBars({ days, goalKcal: 2200, today: TODAY })

		expect(maxIndex).toBe(4)
		expect(bars[4]?.heightRatio).toBeGreaterThan(bars[3]?.heightRatio ?? 1)
		expect(goalY).not.toBeNull()
		expect(goalY ?? 0).toBeGreaterThan(95 - (bars[4]?.heightRatio ?? 0) * 96)
	})

	it('has no goal line without a goal', () => {
		expect(getWeekBars({ days, goalKcal: null, today: TODAY }).goalY).toBeNull()
	})

	it('scales to the goal when it is above every day', () => {
		const { bars } = getWeekBars({ days, goalKcal: 4000, today: TODAY })

		expect(bars[4]?.heightRatio).toBeLessThan(0.6)
	})

	it('draws no bar for a day without food', () => {
		const empty = days.map((day, index) =>
			index === 2 ? { ...day, kcal: 0, proteinG: 0, status: 'empty' as const } : day,
		)
		const { bars } = getWeekBars({ days: empty, goalKcal: 2200, today: TODAY })

		expect(bars[2]?.hasBar).toBe(false)
		expect(bars[2]?.path).toBeNull()
	})

	it('has nothing to measure for a week without food', () => {
		const none = days.map((day) => ({ ...day, kcal: 0, proteinG: 0, status: 'empty' as const }))
		const result = getWeekBars({ days: none, goalKcal: null, today: TODAY })

		expect(result.maxIndex).toBeNull()
		expect(result.bars.every((bar) => !bar.hasBar)).toBe(true)
	})
})

describe('getWeekChartSummary', () => {
	it('says the range of the finished days and today so far', () => {
		expect(getWeekChartSummary({ days, today: TODAY })).toEqual([
			{ key: 'progress.week.chart.range', min: 2000, max: 2420 },
			{ key: 'progress.week.chart.todaySoFar', value: 1370 },
		])
	})

	it('names a single value and a lone today', () => {
		const lone = days.map((day) =>
			day.localDate === TODAY ? day : { ...day, kcal: 0, status: 'empty' as const },
		)

		expect(getWeekChartSummary({ days: lone, today: TODAY })).toEqual([
			{ key: 'progress.week.chart.todayOnly', value: 1370 },
		])
	})
})

describe('getWeekChartSummary without food', () => {
	it('has nothing to say for a week without food', () => {
		const none = days.map((day) => ({ ...day, kcal: 0, proteinG: 0, status: 'empty' as const }))

		expect(getWeekChartSummary({ days: none, today: TODAY })).toEqual([])
	})
})
