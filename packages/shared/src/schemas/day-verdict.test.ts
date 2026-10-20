import { describe, expect, it } from 'vitest'

import {
	DAY_FAR_UNDER_GOAL_RATIO,
	DAY_ON_GOAL_FROM_RATIO,
	DAY_OVER_GOAL_RATIO,
	getDayVerdict,
} from './day-verdict.js'

const GOAL = 1000
/** kcal as a share of the goal in tenths of a percent, so the edges stay exact. */
const verdictAtKcal = (kcal: number) => getDayVerdict({ kcal, entryCount: 3, goalKcal: GOAL })

describe('getDayVerdict', () => {
	it('keeps the thresholds of the calorie ring', () => {
		expect([DAY_FAR_UNDER_GOAL_RATIO, DAY_ON_GOAL_FROM_RATIO, DAY_OVER_GOAL_RATIO]).toEqual([
			0.6, 0.97, 1.03,
		])
	})

	it('is empty without entries, whatever the goal', () => {
		expect(getDayVerdict({ kcal: 0, entryCount: 0, goalKcal: GOAL })).toBe('empty')
		expect(getDayVerdict({ kcal: 0, entryCount: 0, goalKcal: null })).toBe('empty')
	})

	it('has no verdict without a goal', () => {
		expect(getDayVerdict({ kcal: 1800, entryCount: 2, goalKcal: null })).toBe('no_goal')
		expect(getDayVerdict({ kcal: 1800, entryCount: 2, goalKcal: 0 })).toBe('no_goal')
	})

	it('is far_under below 60 % of the goal', () => {
		expect(verdictAtKcal(599)).toBe('far_under')
		expect(verdictAtKcal(100)).toBe('far_under')
	})

	it('is under from 60 % up to but not including 97 %', () => {
		expect(verdictAtKcal(600)).toBe('under')
		expect(verdictAtKcal(969)).toBe('under')
	})

	it('is on_goal from 97 % up to and including 103 %', () => {
		expect(verdictAtKcal(970)).toBe('on_goal')
		expect(verdictAtKcal(1000)).toBe('on_goal')
		expect(verdictAtKcal(1030)).toBe('on_goal')
	})

	it('is over above 103 %', () => {
		expect(verdictAtKcal(1031)).toBe('over')
		expect(verdictAtKcal(1500)).toBe('over')
	})
})
