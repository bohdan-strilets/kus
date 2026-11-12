import { describe, expect, it } from 'vitest'

import {
	formatLocalClock,
	formatLocalTime,
	getDayHistoryStart,
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

	it('formats only the wall clock, midnight as 00', () => {
		expect(formatLocalClock(new Date('2026-10-07T11:20:00Z'), WARSAW)).toBe('13:20')
		expect(formatLocalClock(new Date('2026-10-06T22:05:00Z'), WARSAW)).toBe('00:05')
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

describe('getDayHistoryStart', () => {
	const day = (localDate: string): Date => new Date(`${localDate}T00:00:00Z`)
	const start = (localDate: string): string =>
		getDayHistoryStart(day(localDate), WARSAW).toISOString()

	it('is 20:00 of the evening before on the wall clock', () => {
		// 2026-11-12 in Warsaw is UTC+1
		expect(start('2026-11-12')).toBe('2026-11-11T19:00:00.000Z')
	})

	it('puts 21:00 of yesterday inside the window and 19:00 outside', () => {
		const since = getDayHistoryStart(day('2026-11-12'), WARSAW)
		expect(new Date('2026-11-11T20:00:00Z') >= since).toBe(true) // 21:00 local
		expect(new Date('2026-11-11T18:00:00Z') >= since).toBe(false) // 19:00 local
	})

	it('stays at 20:00 across the spring DST switch (2026-03-29)', () => {
		expect(start('2026-03-29')).toBe('2026-03-28T19:00:00.000Z') // 20:00 CET
		expect(start('2026-03-30')).toBe('2026-03-29T18:00:00.000Z') // 20:00 CEST
	})

	it('stays at 20:00 across the autumn DST switch (2026-10-25)', () => {
		expect(start('2026-10-25')).toBe('2026-10-24T18:00:00.000Z') // 20:00 CEST
		expect(start('2026-10-26')).toBe('2026-10-25T19:00:00.000Z') // 20:00 CET
	})
})
