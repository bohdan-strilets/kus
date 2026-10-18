import { describe, expect, it } from 'vitest'

import { getDayOffset, getLoggableDays, getWeekday, shiftDate } from './dates.js'

describe('getLoggableDays', () => {
	it('lists today − 3 … today + 1 with weekdays and labels', () => {
		expect(getLoggableDays('2026-10-07')).toEqual([
			{ localDate: '2026-10-04', weekday: 'Sun', label: null },
			{ localDate: '2026-10-05', weekday: 'Mon', label: null },
			{ localDate: '2026-10-06', weekday: 'Tue', label: 'yesterday' },
			{ localDate: '2026-10-07', weekday: 'Wed', label: 'today' },
			{ localDate: '2026-10-08', weekday: 'Thu', label: 'tomorrow' },
		])
	})

	it('crosses month, year and leap-day edges', () => {
		expect(getLoggableDays('2026-01-01').map((day) => day.localDate)).toEqual([
			'2025-12-29',
			'2025-12-30',
			'2025-12-31',
			'2026-01-01',
			'2026-01-02',
		])
		expect(getLoggableDays('2028-03-01').map((day) => day.localDate)).toContain('2028-02-29')
	})
})

describe('date helpers', () => {
	it('shifts by whole days in both directions', () => {
		expect(shiftDate('2026-10-31', 1)).toBe('2026-11-01')
		expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
	})

	it('measures the offset from today', () => {
		expect(getDayOffset('2026-10-04', '2026-10-07')).toBe(-3)
		expect(getDayOffset('2026-10-08', '2026-10-07')).toBe(1)
	})

	it('names the weekday', () => {
		expect(getWeekday('2026-10-07')).toBe('Wed')
	})
})
