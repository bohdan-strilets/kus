import { describe, expect, it } from 'vitest'

import type { MeasurementValue } from '../measurements/measurements.mapper'
import {
	averageOrNull,
	getIsWeekendProteinLow,
	getWeekPaceKg,
	type ProteinDay,
} from './progress.utils'

// 2026-10-05 is a Monday, 10 and 11 are the weekend
const day = (localDate: string, proteinG: number, hasEntries = true): ProteinDay => ({
	localDate,
	proteinG,
	hasEntries,
})

const weekdays = [
	day('2026-10-05', 100),
	day('2026-10-06', 100),
	day('2026-10-07', 100),
	day('2026-10-08', 100),
	day('2026-10-09', 100),
]

describe('getIsWeekendProteinLow', () => {
	it('flags a weekend under 0.85 of the weekday average', () => {
		const days = [...weekdays, day('2026-10-10', 80), day('2026-10-11', 80)]
		expect(getIsWeekendProteinLow(days)).toBe(true)
	})

	it('does not flag exactly 0.85 or higher', () => {
		const days = [...weekdays, day('2026-10-10', 85), day('2026-10-11', 85)]
		expect(getIsWeekendProteinLow(days)).toBe(false)
	})

	it('needs data in both groups', () => {
		expect(getIsWeekendProteinLow(weekdays)).toBe(false)
		expect(getIsWeekendProteinLow([day('2026-10-10', 10), day('2026-10-11', 10)])).toBe(false)
	})

	it('skips days without entries instead of counting them as zero', () => {
		const days = [...weekdays, day('2026-10-10', 0, false), day('2026-10-11', 95)]
		expect(getIsWeekendProteinLow(days)).toBe(false)
	})
})

const weight = (localDate: string, value: number): MeasurementValue => ({
	id: localDate,
	kind: 'WEIGHT',
	value,
	localDate: new Date(`${localDate}T00:00:00Z`),
	measuredAt: new Date(`${localDate}T08:00:00Z`),
	source: 'CHAT',
	messageId: null,
})

describe('getWeekPaceKg', () => {
	const today = new Date('2026-10-12T00:00:00Z')

	it('is the latest minus the weight 5–9 days earlier', () => {
		const latest = weight('2026-10-12', 82.4)
		const history = [weight('2026-10-05', 82.8), latest]
		expect(getWeekPaceKg({ latest, history, today })).toBe(-0.4)
	})

	it('is null without a weight in the 5–9 day window', () => {
		const latest = weight('2026-10-12', 82.4)
		const history = [weight('2026-10-10', 82.8), weight('2026-09-20', 90), latest]
		expect(getWeekPaceKg({ latest, history, today })).toBeNull()
	})

	it('is null without any weight or when the latest one is older than a week', () => {
		expect(getWeekPaceKg({ latest: null, history: [], today })).toBeNull()
		const stale = weight('2026-10-01', 82.4)
		expect(
			getWeekPaceKg({ latest: stale, history: [weight('2026-09-25', 83), stale], today }),
		).toBeNull()
	})
})

describe('getWeekPaceKg age limit', () => {
	const today = new Date('2026-10-12T00:00:00Z')

	it('still counts a latest weight that is 6 days old, but not 7', () => {
		const sixDays = weight('2026-10-06', 82)
		expect(
			getWeekPaceKg({ latest: sixDays, history: [weight('2026-09-30', 83), sixDays], today }),
		).toBe(-1)
		const sevenDays = weight('2026-10-05', 82)
		expect(
			getWeekPaceKg({ latest: sevenDays, history: [weight('2026-09-29', 83), sevenDays], today }),
		).toBeNull()
	})
})

describe('averageOrNull', () => {
	it('rounds to a whole number and is null for no values', () => {
		expect(averageOrNull([2420, 1970])).toBe(2195)
		expect(averageOrNull([])).toBeNull()
	})
})
