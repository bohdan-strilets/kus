import { describe, expect, it } from 'vitest'

import { countRangeDays, daysRangeQuerySchema, getDayStatus } from './days.js'

describe('getDayStatus', () => {
	it('is empty without entries, whatever the kcal', () => {
		expect(getDayStatus({ kcal: 0, entryCount: 0, goalKcal: 2000 })).toBe('empty')
	})

	it('counts up to 103 % of the goal as normal, above it as over', () => {
		expect(getDayStatus({ kcal: 2060, entryCount: 3, goalKcal: 2000 })).toBe('normal')
		expect(getDayStatus({ kcal: 2061, entryCount: 3, goalKcal: 2000 })).toBe('over')
	})

	it('is never over without a goal', () => {
		expect(getDayStatus({ kcal: 5000, entryCount: 3, goalKcal: null })).toBe('normal')
		expect(getDayStatus({ kcal: 5000, entryCount: 3, goalKcal: 0 })).toBe('normal')
	})
})

describe('days range', () => {
	it('counts both ends, across a month and the DST switch', () => {
		expect(countRangeDays('2026-10-05', '2026-10-05')).toBe(1)
		expect(countRangeDays('2026-09-29', '2026-10-05')).toBe(7)
		expect(countRangeDays('2026-10-20', '2026-10-30')).toBe(11)
	})

	it('allows 31 days at most and never backwards', () => {
		expect(daysRangeQuerySchema.safeParse({ from: '2026-09-01', to: '2026-10-01' }).success).toBe(
			true,
		)
		expect(daysRangeQuerySchema.safeParse({ from: '2026-08-31', to: '2026-10-01' }).success).toBe(
			false,
		)
		expect(daysRangeQuerySchema.safeParse({ from: '2026-10-02', to: '2026-10-01' }).success).toBe(
			false,
		)
	})
})
