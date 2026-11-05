import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeWorkoutStats } from '@/shared/testing'

import { getBucketBars } from './get-bucket-bars'
import { getGroupRows } from './get-group-rows'
import { getOverviewTiles } from './get-overview-tiles'

const t = i18n.t.bind(i18n)

describe('getGroupRows', () => {
	it('scales bars to the biggest group and puts «Інше» last', () => {
		const rows = getGroupRows([
			{ muscleGroup: null, setCount: 5 },
			{ muscleGroup: 'CHEST', setCount: 10 },
			{ muscleGroup: 'BACK', setCount: 4 },
		])
		expect(rows.map((row) => [row.group, row.widthPercent])).toEqual([
			['CHEST', 100],
			['BACK', 40],
			[null, 50],
		])
	})

	it('has no rows without groups', () => {
		expect(getGroupRows([])).toEqual([])
	})
})

describe('getOverviewTiles', () => {
	it('adds «≈» to the average only for an estimated duration', () => {
		const { overview } = makeWorkoutStats()
		expect(getOverviewTiles(overview, 'month', t)).toMatchObject({
			perWeek: '1,5 на тиждень',
			total: '5 год 10 хв',
			perSession: '≈ 52 хв за раз',
		})
		expect(
			getOverviewTiles({ ...overview, hasEstimatedDuration: false }, 'month', t).perSession,
		).toBe('52 хв за раз')
	})

	it('has no per-week line for a week and no per-session line without a duration', () => {
		const { overview } = makeWorkoutStats()
		const tiles = getOverviewTiles({ ...overview, avgDurationMin: null }, 'week', t)
		expect(tiles.perWeek).toBeNull()
		expect(tiles.perSession).toBeNull()
	})
})

describe('getBucketBars', () => {
	const buckets = Array.from({ length: 4 }, (_, index) => ({ from: `2026-10-0${index + 1}` }))
	const options = { buckets, values: [1, 2, 3, 4], describe: (label: string) => label }

	it('labels a week by weekdays', () => {
		const bars = getBucketBars({ ...options, period: 'week' })
		expect(bars.map((bar) => bar.label)).toEqual(['Чт', 'Пт', 'Сб', 'Нд'])
	})
})

describe('getBucketBars weeks', () => {
	it('labels a week column by its Monday and passes the future flag on', () => {
		const bars = getBucketBars({
			buckets: [{ from: '2026-10-26' }, { from: '2026-11-02', isFuture: true }],
			period: 'month',
			values: [2, 0],
			describe: (label, value) => `${label}: ${value}`,
		})
		expect(bars.map((bar) => bar.label)).toEqual(['26.10', '02.11'])
		expect(bars.map((bar) => bar.isPending)).toEqual([false, true])
	})
})

describe('getOverviewTiles: unknown total', () => {
	const { overview } = makeWorkoutStats()

	it('is a dash and unknown when workouts exist but none has a duration', () => {
		const tiles = getOverviewTiles(
			{ ...overview, workoutCount: 3, durationMin: 0, avgDurationMin: null },
			'month',
			t,
		)

		expect(tiles.isTotalUnknown).toBe(true)
		expect(tiles.total).toBe('—')
		expect(tiles.perSession).toBeNull()
	})

	it('an empty period is not «unknown»: no workouts, the plain zero total', () => {
		const tiles = getOverviewTiles(
			{ ...overview, workoutCount: 0, durationMin: 0, avgDurationMin: null },
			'month',
			t,
		)

		expect(tiles.isTotalUnknown).toBe(false)
		expect(tiles.total).not.toBe('—')
	})

	it('a known average keeps the real total', () => {
		const tiles = getOverviewTiles(overview, 'month', t)

		expect(tiles.isTotalUnknown).toBe(false)
		expect(tiles.total).toBe('5 год 10 хв')
	})
})
