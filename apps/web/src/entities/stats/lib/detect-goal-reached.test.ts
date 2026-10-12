import { describe, expect, it } from 'vitest'

import { detectGoalReached } from './detect-goal-reached'
import type { GaugeStatus } from './get-gauge-state'

const TODAY = '2026-10-12'

interface Case {
	name: string
	previousStatus: GaugeStatus | null
	nextStatus: GaugeStatus
	hasGoal: boolean
	isArmed: boolean
	localDate: string
	expected: boolean
}

const base = {
	previousStatus: 'under',
	nextStatus: 'closed',
	hasGoal: true,
	isArmed: true,
	localDate: TODAY,
} as const

const cases: Case[] = [
	{ name: 'under to closed, armed, today, with a goal', ...base, expected: true },
	{ name: 'the first observation', ...base, previousStatus: null, expected: false },
	{ name: 'closed to closed', ...base, previousStatus: 'closed', expected: false },
	{ name: 'a jump from under to over', ...base, nextStatus: 'over', expected: false },
	{ name: 'over to closed', ...base, previousStatus: 'over', expected: false },
	{ name: 'not armed', ...base, isArmed: false, expected: false },
	{ name: 'another date than today', ...base, localDate: '2026-10-11', expected: false },
	{ name: 'no goal', ...base, hasGoal: false, expected: false },
]

describe('detectGoalReached', () => {
	it.each(cases)('$name -> $expected', ({ expected, ...params }) => {
		const { name: _name, ...detectParams } = params
		expect(detectGoalReached({ ...detectParams, today: TODAY })).toBe(expected)
	})
})
