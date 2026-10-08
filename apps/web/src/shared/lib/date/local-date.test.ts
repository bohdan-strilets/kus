import { describe, expect, it } from 'vitest'

import {
	fromCalendarDate,
	getLocalDateString,
	getLocalHour,
	shiftLocalDate,
	toCalendarDate,
} from './local-date'

const WARSAW = 'Europe/Warsaw'

describe('local date', () => {
	it('uses the day of the timezone, not of UTC', () => {
		// 23:30 UTC on Oct 6 is already 01:30 on Oct 7 in Warsaw
		const moment = new Date('2026-10-06T23:30:00Z')
		expect(getLocalDateString(moment, WARSAW)).toBe('2026-10-07')
		expect(getLocalDateString(moment, 'America/New_York')).toBe('2026-10-06')
		expect(getLocalHour(moment, WARSAW)).toBe(1)
	})

	it('shifts across month and year ends', () => {
		expect(shiftLocalDate('2026-10-01', -1)).toBe('2026-09-30')
		expect(shiftLocalDate('2026-12-31', 1)).toBe('2027-01-01')
	})

	it('keeps the calendar day for the date formatters', () => {
		const date = toCalendarDate('2026-10-05')
		expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 5])
	})

	it('turns a calendar Date back into its day', () => {
		expect(fromCalendarDate(toCalendarDate('2026-03-09'))).toBe('2026-03-09')
	})
})
