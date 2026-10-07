import { describe, expect, it } from 'vitest'

import { formatLocalTime, getLocalDate, getLocalDateString, getLocalHour } from './local-date'

const WARSAW = 'Europe/Warsaw'

describe('local date', () => {
	it('uses the user day, not the UTC day', () => {
		// 23:30 UTC on Oct 6 is already 01:30 on Oct 7 in Warsaw (UTC+2)
		const moment = new Date('2026-10-06T23:30:00Z')
		expect(getLocalDateString(moment, WARSAW)).toBe('2026-10-07')
		expect(getLocalDate(moment, WARSAW).toISOString()).toBe('2026-10-07T00:00:00.000Z')
		expect(getLocalHour(moment, WARSAW)).toBe(1)
	})

	it('formats the local clock for the model', () => {
		expect(formatLocalTime(new Date('2026-10-07T11:20:00Z'), WARSAW)).toBe(
			'2026-10-07 13:20, Wednesday',
		)
	})

	it('reports midnight as hour 0', () => {
		expect(getLocalHour(new Date('2026-10-06T22:00:00Z'), WARSAW)).toBe(0)
	})
})
