import { describe, expect, it } from 'vitest'

import {
	calculateGoals,
	type CalculateGoalsInput,
	getMacroKcal,
	isGoalConsistent,
} from './calculate-goals.js'

/** The design seed: man, 30, 182 cm, «трохи руху», −0.25 kg/week, target 78 kg. */
const seed: CalculateGoalsInput = {
	sex: 'MALE',
	age: 30,
	heightCm: 182,
	weightKg: 84,
	targetWeightKg: 78,
	activityLevel: 'LIGHT',
	goalType: 'LOSE',
	paceKgPerWeek: 0.25,
}

describe('calculateGoals', () => {
	it('reproduces the onboarding plan from 84 kg', () => {
		const result = calculateGoals(seed)

		expect(result).toMatchObject({
			kcal: 2200,
			proteinG: 140,
			carbsG: 230,
			fatG: 80,
			appliedPaceKgPerWeek: 0.25,
			etaWeeks: 24,
			warnings: [],
		})
		// the steps of «Як я порахував»
		expect(result.steps).toEqual({
			bmr: 1832.5,
			activityMultiplier: 1.375,
			tdee: 2519.7,
			adjustmentKcal: -275,
			rawKcal: 2244.7,
		})
	})

	it('reproduces the recalculation from 82.4 kg (goals-recalc)', () => {
		const result = calculateGoals({ ...seed, weightKg: 82.4 })

		expect(result).toMatchObject({
			kcal: 2200,
			proteinG: 140,
			carbsG: 235,
			fatG: 78,
			etaWeeks: 18,
			warnings: [],
		})
	})

	it('sizes protein to the current weight when there is no target', () => {
		expect(calculateGoals({ ...seed, targetWeightKg: null })).toMatchObject({
			proteinG: 151,
			etaWeeks: null,
		})
	})

	it('has no eta when the target lies on the wrong side of the goal', () => {
		expect(calculateGoals({ ...seed, targetWeightKg: 90 }).etaWeeks).toBeNull()
		expect(calculateGoals({ ...seed, targetWeightKg: 84 }).etaWeeks).toBeNull()
		expect(calculateGoals({ ...seed, goalType: 'GAIN', targetWeightKg: 78 }).etaWeeks).toBeNull()
		// a tiny step still takes a week
		expect(calculateGoals({ ...seed, targetWeightKg: 83.9 }).etaWeeks).toBe(1)
	})

	it('caps carbs at 0 and flags it when protein alone exceeds the kcal (absurd target)', () => {
		const result = calculateGoals({ ...seed, targetWeightKg: 300 })

		// protein 540 g = 2160 kcal of a 2200 kcal day; fat drops to 0.6 × 84 = 50 g, carbs would be negative
		expect(result).toMatchObject({ kcal: 2200, proteinG: 540, fatG: 50, carbsG: 0, etaWeeks: null })
		expect(result.warnings).toEqual(['MACROS_ADJUSTED'])
	})

	it('MAINTAIN: no adjustment, no pace, no eta', () => {
		const result = calculateGoals({ ...seed, goalType: 'MAINTAIN', paceKgPerWeek: 0.75 })

		expect(result).toMatchObject({
			kcal: 2500,
			appliedPaceKgPerWeek: null,
			etaWeeks: null,
			warnings: [],
		})
		expect(result.steps.adjustmentKcal).toBe(0)
	})

	it('GAIN adds the surplus', () => {
		const result = calculateGoals({
			sex: 'MALE',
			age: 25,
			heightCm: 180,
			weightKg: 70,
			targetWeightKg: 75,
			activityLevel: 'ACTIVE',
			goalType: 'GAIN',
			paceKgPerWeek: 0.25,
		})

		// 1705 × 1.725 = 2941.1 + 275 = 3216.1 → 3200
		expect(result).toMatchObject({
			kcal: 3200,
			proteinG: 135,
			fatG: 67,
			carbsG: 515,
			etaWeeks: 20,
			warnings: [],
		})
		expect(result.steps.adjustmentKcal).toBe(275)
	})

	it('raises a woman to the 1200 kcal floor and says so', () => {
		const result = calculateGoals({
			sex: 'FEMALE',
			age: 30,
			heightCm: 160,
			weightKg: 50,
			targetWeightKg: null,
			activityLevel: 'SEDENTARY',
			goalType: 'LOSE',
			paceKgPerWeek: 0.5,
		})

		// 1189 × 1.2 = 1426.8 − 550 = 876.8 → 850 → floor 1200
		expect(result).toMatchObject({
			kcal: 1200,
			proteinG: 90,
			fatG: 48,
			carbsG: 100,
			appliedPaceKgPerWeek: 0.5,
			warnings: ['KCAL_FLOOR_APPLIED'],
		})
		expect(result.steps.rawKcal).toBe(876.8)
	})

	it('limits the pace to 1 % of the weight per week', () => {
		const result = calculateGoals({
			sex: 'MALE',
			age: 25,
			heightCm: 175,
			weightKg: 60,
			targetWeightKg: 55,
			activityLevel: 'LIGHT',
			goalType: 'LOSE',
			paceKgPerWeek: 0.75,
		})

		// 60 kg → at most 0.6 kg/week → the 0.5 option
		expect(result).toMatchObject({
			appliedPaceKgPerWeek: 0.5,
			etaWeeks: 10,
			warnings: ['PACE_LIMITED'],
		})
		expect(result.steps.adjustmentKcal).toBe(-550)
	})

	it('lowers fat for the carbs minimum and flags when even that is not enough (woman, 120 kg)', () => {
		const result = calculateGoals({
			sex: 'FEMALE',
			age: 40,
			heightCm: 165,
			weightKg: 120,
			targetWeightKg: 90,
			activityLevel: 'SEDENTARY',
			goalType: 'LOSE',
			paceKgPerWeek: 0.75,
		})

		// 1870.25 × 1.2 = 2244.3 − 825 = 1419.3 → 1400; protein 162, fat 114 leaves −68.5 g of carbs:
		// fat drops to the 0.6 g/kg minimum (72), carbs = (1400 − 648 − 648) / 4 = 26 → 25, still < 50
		expect(result).toMatchObject({
			kcal: 1400,
			proteinG: 162,
			fatG: 72,
			carbsG: 25,
			warnings: ['MACROS_ADJUSTED'],
		})
		expect(getMacroKcal(result)).toBeLessThanOrEqual(1400)
	})

	it('lowers fat just enough when the minimum allows it', () => {
		// a man whose kcal are tight but fat has room to give
		const result = calculateGoals({
			sex: 'MALE',
			age: 50,
			heightCm: 170,
			weightKg: 110,
			targetWeightKg: 100,
			activityLevel: 'SEDENTARY',
			goalType: 'LOSE',
			paceKgPerWeek: 0.75,
		})

		// 1917.5 × 1.2 = 2301 − 825 = 1476 → 1450 → floor 1500; protein 180, fat 105 → carbs −41.25
		// fat for 50 g of carbs would be 64, below the 0.6 × 110 = 66 minimum → 66; carbs = (1500 − 720 − 594) / 4 = 46.5
		expect(result).toMatchObject({ kcal: 1500, proteinG: 180, fatG: 66, carbsG: 45 })
		expect(result.warnings).toEqual(['KCAL_FLOOR_APPLIED', 'MACROS_ADJUSTED'])
	})
})

describe('isGoalConsistent', () => {
	it('accepts macros within 15 % of the kcal and rejects the rest', () => {
		expect(getMacroKcal({ proteinG: 140, carbsG: 225, fatG: 80 })).toBe(2180)
		expect(isGoalConsistent(2200, { proteinG: 140, carbsG: 225, fatG: 80 })).toBe(true)
		// the goals-edit-sheet example: 1990 of 2200 is within 15 %
		expect(isGoalConsistent(2200, { proteinG: 150, carbsG: 190, fatG: 70 })).toBe(true)
		expect(isGoalConsistent(2200, { proteinG: 100, carbsG: 100, fatG: 50 })).toBe(false)
		expect(isGoalConsistent(1500, { proteinG: 200, carbsG: 300, fatG: 100 })).toBe(false)
	})
})
