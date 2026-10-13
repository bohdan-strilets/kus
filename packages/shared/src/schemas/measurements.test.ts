import { describe, expect, it } from 'vitest'

import { achievementResponseSchema, FOOD_STREAK_MILESTONES } from './achievements.js'
import { getIsGoalReached, MEASUREMENT_LIMITS, measurementCardSchema } from './measurements.js'
import { PROFILE_LIMITS, updateProfileRequestSchema } from './profile.js'
import { progressQuerySchema } from './progress.js'

describe('MEASUREMENT_LIMITS', () => {
	it('feeds the profile weight limit', () => {
		expect(PROFILE_LIMITS.weightKg).toBe(MEASUREMENT_LIMITS.WEIGHT)
	})

	it('accepts the profile weight at the limits and rejects just outside', () => {
		const { min, max } = MEASUREMENT_LIMITS.WEIGHT
		const parse = (weightKg: number) => updateProfileRequestSchema.safeParse({ weightKg }).success
		expect(parse(min)).toBe(true)
		expect(parse(max)).toBe(true)
		expect(parse(min - 0.1)).toBe(false)
		expect(parse(max + 0.1)).toBe(false)
	})

	it('keeps waist inside 40–200 cm', () => {
		expect(MEASUREMENT_LIMITS.WAIST).toEqual({ min: 40, max: 200 })
	})

	it('feeds the profile waist limit', () => {
		expect(PROFILE_LIMITS.waistCm).toBe(MEASUREMENT_LIMITS.WAIST)
	})

	it('accepts the profile waist with a decimal, at the limits, and rejects just outside', () => {
		const { min, max } = MEASUREMENT_LIMITS.WAIST
		const parse = (waistCm: number) => updateProfileRequestSchema.safeParse({ waistCm }).success
		expect(parse(min)).toBe(true)
		expect(parse(max)).toBe(true)
		expect(parse(82.4)).toBe(true)
		expect(parse(min - 0.1)).toBe(false)
		expect(parse(max + 0.1)).toBe(false)
	})

	it('counts waistCm alone as a non-empty profile update', () => {
		expect(updateProfileRequestSchema.safeParse({ waistCm: 82 }).success).toBe(true)
		expect(updateProfileRequestSchema.safeParse({}).success).toBe(false)
	})
})

describe('progressQuerySchema', () => {
	it('defaults to 7 days', () => {
		expect(progressQuerySchema.parse({}).range).toBe(7)
	})

	it('accepts 7, 30 and 90, also as query strings', () => {
		expect(progressQuerySchema.parse({ range: '7' }).range).toBe(7)
		expect(progressQuerySchema.parse({ range: '30' }).range).toBe(30)
		expect(progressQuerySchema.parse({ range: 90 }).range).toBe(90)
	})

	it('rejects any other range', () => {
		expect(progressQuerySchema.safeParse({ range: '8' }).success).toBe(false)
		expect(progressQuerySchema.safeParse({ range: 'abc' }).success).toBe(false)
	})
})

describe('FOOD_STREAK_MILESTONES', () => {
	it('is ascending', () => {
		expect([...FOOD_STREAK_MILESTONES]).toEqual([3, 7, 14, 30, 60, 100])
	})
})

describe('getIsGoalReached', () => {
	it('LOSE is reached at or below the target', () => {
		const reached = (current: number) => getIsGoalReached({ goalType: 'LOSE', current, target: 75 })
		expect(reached(75.1)).toBe(false)
		expect(reached(75)).toBe(true)
		expect(reached(74)).toBe(true)
	})

	it('GAIN is reached at or above the target', () => {
		const reached = (current: number) => getIsGoalReached({ goalType: 'GAIN', current, target: 75 })
		expect(reached(74.9)).toBe(false)
		expect(reached(75)).toBe(true)
		expect(reached(76)).toBe(true)
	})

	it('is null for MAINTAIN, without a goal and without a target', () => {
		expect(getIsGoalReached({ goalType: 'MAINTAIN', current: 75, target: 75 })).toBeNull()
		expect(getIsGoalReached({ goalType: null, current: 75, target: 75 })).toBeNull()
		expect(getIsGoalReached({ goalType: 'LOSE', current: 75, target: null })).toBeNull()
	})
})

describe('measurementCardSchema', () => {
	const point = (day: number) => ({
		localDate: `2026-10-${String(day).padStart(2, '0')}`,
		value: 82,
	})
	const card = (chart: unknown[]) => ({
		id: '01999a00-0000-7000-8000-000000000001',
		kind: 'WEIGHT',
		value: 82,
		localDate: '2026-10-07',
		source: 'CHAT',
		fromStart: null,
		toGoal: null,
		isGoalReached: null,
		weekChange: null,
		planPaceKgPerWeek: null,
		chart,
	})

	it('allows up to 5 chart points and rejects the sixth', () => {
		expect(measurementCardSchema.safeParse(card([1, 2, 3, 4, 5].map(point))).success).toBe(true)
		expect(measurementCardSchema.safeParse(card([1, 2, 3, 4, 5, 6].map(point))).success).toBe(false)
	})

	it('accepts an empty chart', () => {
		expect(measurementCardSchema.safeParse(card([])).success).toBe(true)
	})
})

describe('achievementResponseSchema', () => {
	const achievement = (value: number) => ({
		id: '01999a00-0000-7000-8000-000000000001',
		type: 'FOOD_STREAK',
		value,
		achievedAt: '2026-10-07T10:00:00.000Z',
	})

	it('needs a positive whole value', () => {
		expect(achievementResponseSchema.safeParse(achievement(3)).success).toBe(true)
		expect(achievementResponseSchema.safeParse(achievement(0)).success).toBe(false)
		expect(achievementResponseSchema.safeParse(achievement(-1)).success).toBe(false)
		expect(achievementResponseSchema.safeParse(achievement(1.5)).success).toBe(false)
	})
})
