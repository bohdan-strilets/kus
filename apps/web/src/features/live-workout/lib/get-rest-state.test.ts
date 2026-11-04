import { describe, expect, it } from 'vitest'

import { getRestState, type RestStateInput } from './get-rest-state'

const DONE_AT = '2026-11-04T10:00:00.000Z'
const DONE_MS = new Date(DONE_AT).getTime()
const REST_SEC = 90
const MS_IN_SECOND = 1000
const MS_IN_HOUR = 3_600_000

const input = (overrides: Partial<RestStateInput> = {}): RestStateInput => ({
	lastDoneAt: DONE_AT,
	restSec: REST_SEC,
	extraSec: 0,
	isSkipped: false,
	hasNextSet: true,
	nowMs: DONE_MS,
	...overrides,
})

describe('getRestState', () => {
	it('right after the set: running with the whole rest', () => {
		expect(getRestState(input())).toEqual({ status: 'running', remainingSec: 90, totalSec: 90 })
	})

	it('exactly 0 left is ended with no overdue', () => {
		const state = getRestState(input({ nowMs: DONE_MS + REST_SEC * MS_IN_SECOND }))

		expect(state).toMatchObject({ status: 'ended', totalSec: 90 })
		// the code returns -0 here; Math.abs keeps the test about the value, not the sign of zero
		expect(state.status === 'ended' && Math.abs(state.overdueMs)).toBe(0)
	})

	it('1 ms before the end is still running with 1 s', () => {
		expect(getRestState(input({ nowMs: DONE_MS + REST_SEC * MS_IN_SECOND - 1 }))).toEqual({
			status: 'running',
			remainingSec: 1,
			totalSec: 90,
		})
	})

	it('rounds the remaining seconds up', () => {
		expect(getRestState(input({ nowMs: DONE_MS + 30_500 }))).toMatchObject({
			status: 'running',
			remainingSec: 60,
		})
	})

	it('a clock behind doneAt does not show more than the whole rest', () => {
		expect(getRestState(input({ nowMs: DONE_MS - 5_000 }))).toEqual({
			status: 'running',
			remainingSec: 90,
			totalSec: 90,
		})
	})

	it('extraSec lengthens the rest and the total', () => {
		expect(getRestState(input({ extraSec: 15, nowMs: DONE_MS + 90_000 }))).toEqual({
			status: 'running',
			remainingSec: 15,
			totalSec: 105,
		})
	})

	it('extraSec moves the end', () => {
		const nowMs = DONE_MS + 95_000

		expect(getRestState(input({ nowMs })).status).toBe('ended')
		expect(getRestState(input({ nowMs, extraSec: 15 })).status).toBe('running')
	})

	it('a big overdue stays ended with the real overdue', () => {
		expect(getRestState(input({ nowMs: DONE_MS + 3 * MS_IN_HOUR }))).toEqual({
			status: 'ended',
			totalSec: 90,
			overdueMs: 3 * MS_IN_HOUR - 90_000,
		})
	})

	it('skipped is idle, running or ended', () => {
		expect(getRestState(input({ isSkipped: true })).status).toBe('idle')
		expect(getRestState(input({ isSkipped: true, nowMs: DONE_MS + 999_000 })).status).toBe('idle')
	})

	it('no next set (last set of the last exercise) is idle', () => {
		expect(getRestState(input({ hasNextSet: false })).status).toBe('idle')
		expect(getRestState(input({ hasNextSet: false, nowMs: DONE_MS + 999_000 })).status).toBe('idle')
	})

	it('no done set is idle', () => {
		expect(getRestState(input({ lastDoneAt: null }))).toEqual({ status: 'idle' })
	})

	it('an invalid date is idle, not NaN', () => {
		expect(getRestState(input({ lastDoneAt: 'not-a-date' }))).toEqual({ status: 'idle' })
	})
})
