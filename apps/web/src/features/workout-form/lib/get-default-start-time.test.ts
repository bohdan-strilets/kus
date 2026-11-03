import { describe, expect, it } from 'vitest'

import { getDefaultStartTime } from './get-default-start-time'

describe('getDefaultStartTime', () => {
	it('is now minus the duration', () => {
		expect(getDefaultStartTime('18:30', 55)).toBe('17:35')
		expect(getDefaultStartTime('18:30', 30)).toBe('18:00')
		expect(getDefaultStartTime('09:05', 10)).toBe('08:55')
	})

	it('without a duration (null, 0, negative) it is now', () => {
		expect(getDefaultStartTime('18:30', null)).toBe('18:30')
		expect(getDefaultStartTime('18:30', 0)).toBe('18:30')
		expect(getDefaultStartTime('18:30', -5)).toBe('18:30')
	})

	it('stops at 00:00 when the duration crosses midnight', () => {
		expect(getDefaultStartTime('00:20', 60)).toBe('00:00')
		expect(getDefaultStartTime('01:00', 600)).toBe('00:00')
	})

	it('exactly reaching midnight is 00:00', () => {
		expect(getDefaultStartTime('01:30', 90)).toBe('00:00')
	})

	it('the result is always a valid HH:mm', () => {
		expect(getDefaultStartTime('00:00', 5)).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
		expect(getDefaultStartTime('23:59', 1)).toBe('23:58')
	})
})
