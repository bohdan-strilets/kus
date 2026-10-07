import { describe, expect, it } from 'vitest'

import { formatDayHeading, formatTime, formatWeekdayShort } from './format-date'

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
