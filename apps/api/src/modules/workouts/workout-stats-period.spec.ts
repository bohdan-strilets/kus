import { describe, expect, it } from 'vitest'

import { addMonthsClamped, getStatsPeriodRange } from './workout-stats-period'

const MS_IN_DAY = 86_400_000

describe('getStatsPeriodRange', () => {
	it('week is Monday to Sunday with 7 day buckets', () => {
		// 2026-10-28 is a Wednesday
		const range = getStatsPeriodRange('week', '2026-10-28')
		expect(range).toMatchObject({ from: '2026-10-26', to: '2026-11-01' })
		expect(range.buckets).toHaveLength(7)
		expect(range.buckets[0]).toEqual({ from: '2026-10-26', to: '2026-10-26' })
		expect(range.previous).toEqual({ from: '2026-10-19', to: '2026-10-21' })
	})

	it('a Sunday belongs to the week that started on Monday', () => {
		expect(getStatsPeriodRange('week', '2026-11-01').from).toBe('2026-10-26')
		expect(getStatsPeriodRange('week', '2026-10-26').from).toBe('2026-10-26')
	})

	it('month is the calendar month with Monday weeks clipped to it', () => {
		const range = getStatsPeriodRange('month', '2026-10-28')
		expect(range).toMatchObject({ from: '2026-10-01', to: '2026-10-31' })
		expect(range.buckets[0]).toEqual({ from: '2026-10-01', to: '2026-10-04' })
		expect(range.buckets[1]).toEqual({ from: '2026-10-05', to: '2026-10-11' })
		expect(range.buckets.at(-1)).toEqual({ from: '2026-10-26', to: '2026-10-31' })
		expect(range.buckets).toHaveLength(5)
		expect(range.previous).toEqual({ from: '2026-09-01', to: '2026-09-28' })
	})

	it('month across the year boundary', () => {
		const range = getStatsPeriodRange('month', '2027-01-05')
		expect(range).toMatchObject({ from: '2027-01-01', to: '2027-01-31' })
		expect(range.buckets[0]).toEqual({ from: '2027-01-01', to: '2027-01-03' })
		expect(range.previous).toEqual({ from: '2026-12-01', to: '2026-12-05' })
	})

	it('quarter is this month and the two before, across the year boundary', () => {
		const range = getStatsPeriodRange('quarter', '2027-01-15')
		expect(range).toMatchObject({ from: '2026-11-01', to: '2027-01-31' })
		expect(range.buckets[0]).toEqual({ from: '2026-11-01', to: '2026-11-01' })
		expect(range.buckets.at(-1)).toEqual({ from: '2027-01-25', to: '2027-01-31' })
		expect(range.previous).toEqual({ from: '2026-08-01', to: '2026-10-15' })
	})

	it('clamps the previous period to the end of a shorter month', () => {
		expect(getStatsPeriodRange('month', '2026-03-31').previous).toEqual({
			from: '2026-02-01',
			to: '2026-02-28',
		})
		expect(getStatsPeriodRange('month', '2028-03-31').previous.to).toBe('2028-02-29')
		expect(getStatsPeriodRange('quarter', '2026-05-31').previous.to).toBe('2026-02-28')
	})

	it('buckets cover the period without gaps', () => {
		const range = getStatsPeriodRange('quarter', '2026-10-28')
		expect(range.buckets[0]?.from).toBe(range.from)
		expect(range.buckets.at(-1)?.to).toBe(range.to)
		range.buckets.slice(1).forEach((bucket, index) => {
			const previousEnd = Date.parse(`${range.buckets[index]?.to}T00:00:00Z`)
			expect(Date.parse(`${bucket.from}T00:00:00Z`) - previousEnd).toBe(MS_IN_DAY)
		})
	})
})

describe('addMonthsClamped', () => {
	it('keeps the day when the month is long enough', () => {
		expect(addMonthsClamped('2026-10-15', -3)).toBe('2026-07-15')
		expect(addMonthsClamped('2026-01-31', -2)).toBe('2025-11-30')
	})
})
