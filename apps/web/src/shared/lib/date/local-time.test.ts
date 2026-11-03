import { describe, expect, it } from 'vitest'

import { getLocalDateString, getLocalTime } from './local-date'

const WARSAW = 'Europe/Warsaw'

describe('getLocalTime', () => {
	it('gives HH:mm of the timezone, not of UTC', () => {
		const moment = new Date('2026-11-02T17:30:00Z')

		expect(getLocalTime(moment, WARSAW)).toBe('18:30')
		expect(getLocalTime(moment, 'America/New_York')).toBe('12:30')
	})

	it('pads single digits', () => {
		expect(getLocalTime(new Date('2026-11-02T05:07:00Z'), 'UTC')).toBe('05:07')
	})

	it('shows 00:xx (not 24:xx) just after midnight, on the new day', () => {
		const moment = new Date('2026-11-02T23:05:00Z')

		expect(getLocalTime(moment, WARSAW)).toBe('00:05')
		expect(getLocalDateString(moment, WARSAW)).toBe('2026-11-03')
	})

	it('follows the summer / winter shift', () => {
		expect(getLocalTime(new Date('2026-07-01T12:00:00Z'), WARSAW)).toBe('14:00')
		expect(getLocalTime(new Date('2026-12-01T12:00:00Z'), WARSAW)).toBe('13:00')
	})
})
