import { describe, expect, it } from 'vitest'

import { findFormTimeIssue, getFormTime } from './form-time'

const WARSAW = 'Europe/Warsaw'
const NOW = new Date('2026-11-10T12:00:00Z') // 13:00 in Warsaw (CET)

const startOf = (localDate: string, startTime: string, timezone = WARSAW): string =>
	getFormTime({ localDate, startTime, durationMin: 5, timezone }).startedAt.toISOString()

describe('getFormTime', () => {
	it('converts HH:mm in the user time zone to UTC (winter, UTC+1) and adds the duration', () => {
		const { startedAt, finishedAt } = getFormTime({
			localDate: '2026-11-10',
			startTime: '18:30',
			durationMin: 75,
			timezone: WARSAW,
		})
		expect(startedAt.toISOString()).toBe('2026-11-10T17:30:00.000Z')
		expect(finishedAt.toISOString()).toBe('2026-11-10T18:45:00.000Z')
	})

	it('converts in summer (UTC+2)', () => {
		expect(startOf('2026-07-15', '07:05')).toBe('2026-07-15T05:05:00.000Z')
	})

	it('puts 00:30 local on the day before in UTC', () => {
		expect(startOf('2026-11-10', '00:30')).toBe('2026-11-09T23:30:00.000Z')
	})

	it('handles the spring-forward day (2026-03-29): 01:30 is CET, 04:00 is CEST', () => {
		expect(startOf('2026-03-29', '01:30')).toBe('2026-03-29T00:30:00.000Z')
		expect(startOf('2026-03-29', '04:00')).toBe('2026-03-29T02:00:00.000Z')
	})

	it('handles the fall-back day (2026-10-25): 01:30 is CEST, 04:00 is CET', () => {
		expect(startOf('2026-10-25', '01:30')).toBe('2026-10-24T23:30:00.000Z')
		expect(startOf('2026-10-25', '04:00')).toBe('2026-10-25T03:00:00.000Z')
	})

	it('a time that does not exist (02:30 on the spring-forward day) or repeats (02:30 on the fall-back day) still lands within the hour', () => {
		const gap = new Date(startOf('2026-03-29', '02:30')).getTime()
		const repeated = new Date(startOf('2026-10-25', '02:30')).getTime()
		expect(gap).toBeGreaterThanOrEqual(Date.parse('2026-03-29T00:30:00Z'))
		expect(gap).toBeLessThanOrEqual(Date.parse('2026-03-29T01:30:00Z'))
		expect(repeated).toBeGreaterThanOrEqual(Date.parse('2026-10-25T00:30:00Z'))
		expect(repeated).toBeLessThanOrEqual(Date.parse('2026-10-25T01:30:00Z'))
	})

	it('is the same wall clock in UTC', () => {
		expect(startOf('2026-11-10', '09:15', 'UTC')).toBe('2026-11-10T09:15:00.000Z')
	})
})

describe('findFormTimeIssue', () => {
	const issueFor = (localDate: string, startTime = '08:00', now = NOW) => {
		const { startedAt } = getFormTime({ localDate, startTime, durationMin: 30, timezone: WARSAW })
		return findFormTimeIssue({ localDate, startedAt, now, timezone: WARSAW })
	}

	it('accepts today and the 3 days before', () => {
		expect(issueFor('2026-11-10')).toBeNull()
		expect(issueFor('2026-11-07')).toBeNull()
	})

	it('rejects 4 days back as TOO_OLD', () => {
		expect(issueFor('2026-11-06')).toEqual({ field: 'localDate', code: 'TOO_OLD' })
	})

	it('rejects tomorrow as IN_FUTURE', () => {
		expect(issueFor('2026-11-11')).toEqual({ field: 'localDate', code: 'IN_FUTURE' })
	})

	it('rejects a start later today', () => {
		expect(issueFor('2026-11-10', '14:00')).toEqual({ field: 'startTime', code: 'IN_FUTURE' })
	})

	it('tolerates a start a few minutes ahead (fast phone), not more', () => {
		expect(issueFor('2026-11-10', '13:04')).toBeNull()
		expect(issueFor('2026-11-10', '13:06')).toEqual({ field: 'startTime', code: 'IN_FUTURE' })
	})

	it('reads the user calendar day, not the UTC one', () => {
		// 23:30Z on the 10th is already the 11th in Warsaw: the 11th is today
		const lateNow = new Date('2026-11-10T23:30:00Z')
		expect(issueFor('2026-11-11', '00:10', lateNow)).toBeNull()
		expect(issueFor('2026-11-07', '08:00', lateNow)).toEqual({
			field: 'localDate',
			code: 'TOO_OLD',
		})
	})
})
