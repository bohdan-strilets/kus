import { describe, expect, it } from 'vitest'

import {
	formatDayHeading,
	formatDayMonth,
	formatShortDate,
	formatTime,
	formatWeekdayShort,
} from './format-date'

// seed day from design/docs/screens.md: Monday, 5 October
const SEED_DAY = new Date(2026, 9, 5, 8, 40)

describe('formatTime', () => {
	it('shows hours and minutes with a leading zero', () => {
		expect(formatTime(SEED_DAY)).toBe('08:40')
	})
})

describe('formatDayHeading', () => {
	it('writes the weekday with a capital and the month in the genitive', () => {
		expect(formatDayHeading(SEED_DAY)).toBe('Понеділок, 5 жовтня')
	})
})

describe('formatWeekdayShort', () => {
	it('gives a two-letter capitalised weekday', () => {
		expect(formatWeekdayShort(SEED_DAY)).toBe('Пн')
	})
})

describe('formatDayMonth', () => {
	it('writes the month in the genitive without a capital', () => {
		expect(formatDayMonth(new Date(2026, 8, 5))).toBe('5 вересня')
	})
})

describe('formatShortDate', () => {
	it('gives day.month without a trailing dot', () => {
		expect(formatShortDate(new Date(2026, 10, 8, 12))).toBe('08.11')
	})

	it('takes the day in the given time zone', () => {
		const lateEveningUtc = new Date('2026-11-07T23:30:00.000Z')
		expect(formatShortDate(lateEveningUtc, 'Europe/Warsaw')).toBe('08.11')
		expect(formatShortDate(lateEveningUtc, 'UTC')).toBe('07.11')
	})
})
