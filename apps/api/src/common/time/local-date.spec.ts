import { describe, expect, it } from 'vitest'

import {
	formatLocalTime,
	getLocalDate,
	getLocalDateString,
	getLocalHour,
	getZonedMoment,
} from './local-date'

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

	describe('getZonedMoment', () => {
		it('turns a local hour into the UTC moment', () => {
			const day = new Date('2026-10-07T00:00:00Z')
			expect(getZonedMoment(day, 8, WARSAW).toISOString()).toBe('2026-10-07T06:00:00.000Z')
			expect(getZonedMoment(day, 19, 'America/New_York').toISOString()).toBe(
				'2026-10-07T23:00:00.000Z',
			)
		})

		it('follows the winter offset after the DST switch', () => {
			// Warsaw goes UTC+2 → UTC+1 on 2026-10-25 at 03:00
			const day = new Date('2026-10-25T00:00:00Z')
			expect(getZonedMoment(day, 1, WARSAW).toISOString()).toBe('2026-10-24T23:00:00.000Z')
			expect(getZonedMoment(day, 13, WARSAW).toISOString()).toBe('2026-10-25T12:00:00.000Z')
		})
	})
})
