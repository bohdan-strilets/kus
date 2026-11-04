import { describe, expect, it } from 'vitest'

import { findFormTimeIssue, getFormTime } from './form-time'

const WARSAW = 'Europe/Warsaw'
const NOW = new Date('2026-11-10T12:00:00Z') // 13:00 in Warsaw (CET)

const startOf = (localDate: string, startTime: string, timezone = WARSAW): string =>
	getFormTime({ localDate, startTime, durationMin: 5, timezone, now: NOW }).startedAt.toISOString()

describe('getFormTime', () => {
	it('converts HH:mm in the user time zone to UTC (winter, UTC+1) and adds the duration', () => {
		const { startedAt, finishedAt } = getFormTime({
			localDate: '2026-11-10',
			startTime: '18:30',
			durationMin: 75,
			timezone: WARSAW,
			now: new Date('2026-11-11T00:00:00Z'),
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

describe('finish never later than now', () => {
	const MINUTE = 60_000
	const finishOf = (params: {
		localDate: string
		startTime: string
		durationMin: number
		now: Date
	}): string => getFormTime({ ...params, timezone: WARSAW }).finishedAt.toISOString()

	it('clamps to now when the session started 30 min ago and «lasted» 60', () => {
		// 12:30Z start, now 13:00Z: the planned end 13:30Z has not come yet
		const now = new Date('2026-11-10T13:00:00Z')
		expect(finishOf({ localDate: '2026-11-10', startTime: '13:30', durationMin: 60, now })).toBe(
			now.toISOString(),
		)
	})

	it('is the start itself when the start is after now (phone-clock tolerance)', () => {
		const { startedAt, finishedAt } = getFormTime({
			localDate: '2026-11-10',
			startTime: '13:04', // 12:04Z, now 12:00Z
			durationMin: 30,
			timezone: WARSAW,
			now: NOW,
		})
		expect(startedAt.getTime()).toBeGreaterThan(NOW.getTime())
		expect(finishedAt.getTime()).toBe(startedAt.getTime())
	})

	it('keeps start + duration for a session in the past', () => {
		expect(
			finishOf({ localDate: '2026-11-10', startTime: '08:00', durationMin: 45, now: NOW }),
		).toBe('2026-11-10T07:45:00.000Z')
		expect(
			finishOf({ localDate: '2026-11-08', startTime: '23:30', durationMin: 90, now: NOW }),
		).toBe('2026-11-09T00:00:00.000Z')
	})

	it('keeps the finish when it is exactly now', () => {
		// 12:00 Warsaw = 11:00Z; 60 min later is exactly NOW
		expect(
			finishOf({ localDate: '2026-11-10', startTime: '12:00', durationMin: 60, now: NOW }),
		).toBe(NOW.toISOString())
	})

	it('near midnight in Warsaw: a finish past local midnight is kept when it is already past', () => {
		const now = new Date('2026-11-10T23:30:00Z') // 00:30 on the 11th in Warsaw
		expect(finishOf({ localDate: '2026-11-10', startTime: '23:30', durationMin: 45, now })).toBe(
			'2026-11-10T23:15:00.000Z',
		)
	})

	it('near midnight in Warsaw: a finish past local midnight is clamped to now when it is still ahead', () => {
		const now = new Date('2026-11-10T22:50:00Z') // 23:50 on the 10th in Warsaw
		expect(finishOf({ localDate: '2026-11-10', startTime: '23:30', durationMin: 45, now })).toBe(
			new Date(now.getTime()).toISOString(),
		)
		expect(now.getTime() - Date.parse('2026-11-10T22:30:00Z')).toBe(20 * MINUTE)
	})
})

describe('findFormTimeIssue', () => {
	const issueFor = (localDate: string, startTime = '08:00', now = NOW) => {
		const { startedAt } = getFormTime({
			localDate,
			startTime,
			durationMin: 30,
			timezone: WARSAW,
			now,
		})
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
