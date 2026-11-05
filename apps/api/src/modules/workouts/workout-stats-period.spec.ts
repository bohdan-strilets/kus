import { describe, expect, it } from 'vitest'

import { addMonthsClamped, getStatsPeriodRange } from './workout-stats-period'

const MS_IN_DAY = 86_400_000

const week = (from: string, to: string, isFuture = false) => ({ from, to, isFuture })

describe('getStatsPeriodRange', () => {
	it('week is Monday to Sunday with 7 day buckets', () => {
		// 2026-10-28 is a Wednesday
		const range = getStatsPeriodRange('week', '2026-10-28')
		expect(range).toMatchObject({ from: '2026-10-26', to: '2026-11-01' })
		expect(range.buckets).toHaveLength(7)
		expect(range.buckets[0]).toEqual(week('2026-10-26', '2026-10-26'))
		expect(range.previous).toEqual({ from: '2026-10-19', to: '2026-10-21' })
	})

	it('week marks the days after today as future', () => {
		const range = getStatsPeriodRange('week', '2026-10-28')
		expect(range.buckets.map((bucket) => bucket.isFuture)).toEqual([
			false,
			false,
			false,
			true,
			true,
			true,
			true,
		])
		expect(
			getStatsPeriodRange('week', '2026-11-01').buckets.some((bucket) => bucket.isFuture),
		).toBe(false)
	})

	it('a Sunday belongs to the week that started on Monday', () => {
		expect(getStatsPeriodRange('week', '2026-11-01').from).toBe('2026-10-26')
		expect(getStatsPeriodRange('week', '2026-10-26').from).toBe('2026-10-26')
	})

	it('month is the calendar month with whole Monday–Sunday weeks up to the current one', () => {
		const range = getStatsPeriodRange('month', '2026-10-28')
		expect(range).toMatchObject({ from: '2026-10-01', to: '2026-10-31' })
		expect(range.buckets[0]).toEqual(week('2026-09-28', '2026-10-04'))
		expect(range.buckets[1]).toEqual(week('2026-10-05', '2026-10-11'))
		expect(range.buckets.at(-1)).toEqual(week('2026-10-26', '2026-11-01'))
		expect(range.buckets).toHaveLength(5)
		expect(range.previous).toEqual({ from: '2026-09-01', to: '2026-09-28' })
	})

	it('month starting on a Sunday has the week of 26.10 and stops at the current week', () => {
		// 2026-11-05 is a Thursday, 2026-11-01 a Sunday
		const range = getStatsPeriodRange('month', '2026-11-05')
		expect(range).toMatchObject({ from: '2026-11-01', to: '2026-11-30' })
		expect(range.buckets).toEqual([
			week('2026-10-26', '2026-11-01'),
			week('2026-11-02', '2026-11-08'),
		])
	})

	it('month across the year boundary', () => {
		const range = getStatsPeriodRange('month', '2027-01-05')
		expect(range).toMatchObject({ from: '2027-01-01', to: '2027-01-31' })
		expect(range.buckets).toEqual([
			week('2026-12-28', '2027-01-03'),
			week('2027-01-04', '2027-01-10'),
		])
		expect(range.previous).toEqual({ from: '2026-12-01', to: '2026-12-05' })
	})

	it('quarter is this month and the two before, across the year boundary', () => {
		const range = getStatsPeriodRange('quarter', '2027-01-15')
		expect(range).toMatchObject({ from: '2026-11-01', to: '2027-01-31' })
		expect(range.buckets[0]).toEqual(week('2026-10-26', '2026-11-01'))
		expect(range.buckets.at(-1)).toEqual(week('2027-01-11', '2027-01-17'))
		expect(range.buckets).toHaveLength(12)
		expect(range.previous).toEqual({ from: '2026-08-01', to: '2026-10-15' })
	})

	it('quarter on 05.11 runs from the week of 31.08 to the week of 02.11', () => {
		const range = getStatsPeriodRange('quarter', '2026-11-05')
		expect(range.buckets).toHaveLength(10)
		expect(range.buckets[0]).toEqual(week('2026-08-31', '2026-09-06'))
		expect(range.buckets.at(-1)).toEqual(week('2026-11-02', '2026-11-08'))
	})

	it('clamps the previous period to the end of a shorter month', () => {
		expect(getStatsPeriodRange('month', '2026-03-31').previous).toEqual({
			from: '2026-02-01',
			to: '2026-02-28',
		})
		expect(getStatsPeriodRange('month', '2028-03-31').previous.to).toBe('2028-02-29')
		expect(getStatsPeriodRange('quarter', '2026-05-31').previous.to).toBe('2026-02-28')
	})

	it('week buckets are whole, contiguous, start on a Monday and are never future', () => {
		const today = '2026-10-28'
		const range = getStatsPeriodRange('quarter', today)
		expect(range.buckets[0]?.from).toBe('2026-07-27')
		expect(range.buckets.at(-1)?.to).toBe('2026-11-01')
		range.buckets.forEach((bucket, index) => {
			expect(Date.parse(`${bucket.to}T00:00:00Z`) - Date.parse(`${bucket.from}T00:00:00Z`)).toBe(
				6 * MS_IN_DAY,
			)
			expect(bucket.isFuture).toBe(false)
			const previous = range.buckets[index - 1]
			if (!previous) return
			expect(Date.parse(`${bucket.from}T00:00:00Z`) - Date.parse(`${previous.to}T00:00:00Z`)).toBe(
				MS_IN_DAY,
			)
		})
	})
})

describe('addMonthsClamped', () => {
	it('keeps the day when the month is long enough', () => {
		expect(addMonthsClamped('2026-10-15', -3)).toBe('2026-07-15')
		expect(addMonthsClamped('2026-01-31', -2)).toBe('2025-11-30')
	})
})
