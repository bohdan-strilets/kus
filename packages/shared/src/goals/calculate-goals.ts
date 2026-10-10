import type { ActivityLevel, GoalType, Sex } from '../schemas/enums.js'
import { KCAL_PER_GRAM } from '../schemas/food-entry.js'

// Mifflin–St Jeor × activity, then the pace deficit/surplus; the steps mirror «Як я порахував»
// (design/mockups/onboarding-5-plan-how.html). Only LIGHT (1.375) is shown in the mockup; the rest
// are the standard multipliers. VERY_ACTIVE stays in the DB enum but the profile offers four levels.
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
	SEDENTARY: 1.2,
	LIGHT: 1.375,
	MODERATE: 1.55,
	ACTIVE: 1.725,
	VERY_ACTIVE: 1.9,
}

/** The pace choices of «Темп»; always positive, the goal type gives the sign. */
export const PACE_OPTIONS_KG_PER_WEEK = [0.25, 0.5, 0.75] as const
export type PaceKgPerWeek = (typeof PACE_OPTIONS_KG_PER_WEEK)[number]

/** Faster than this is an extreme deficit; the pace is lowered to the largest option that fits. */
export const MAX_PACE_SHARE_OF_WEIGHT = 0.01
/** The calories go no lower than this, whatever the pace (CLAUDE.md §6: no extreme deficits). */
export const KCAL_FLOOR: Record<Sex, number> = { MALE: 1500, FEMALE: 1200 }

export const KCAL_PER_KG_BODY_FAT = 7700
const DAYS_PER_WEEK = 7
export const KCAL_ROUNDING_STEP = 50

/** Protein is sized to the target weight (or the current one without a target). */
export const PROTEIN_G_PER_KG_TARGET = 1.8
export const FAT_G_PER_KG = 0.95
/** Fat is lowered to make room for the carbs minimum, but never below this. */
export const FAT_MIN_G_PER_KG = 0.6
export const CARBS_MIN_G = 50
const CARBS_ROUNDING_STEP = 5

/** Manual goals must sum up (4P + 4C + 9F) to within this share of the kcal. */
export const MANUAL_GOALS_TOLERANCE = 0.15

export const GOAL_WARNINGS = ['KCAL_FLOOR_APPLIED', 'PACE_LIMITED', 'MACROS_ADJUSTED'] as const
export type GoalWarning = (typeof GOAL_WARNINGS)[number]

export interface CalculateGoalsInput {
	sex: Sex
	/** Years, not a birth year: the API converts with the user's local year. */
	age: number
	heightCm: number
	weightKg: number
	targetWeightKg: number | null
	activityLevel: ActivityLevel
	goalType: GoalType
	/** Ignored for MAINTAIN; required for LOSE and GAIN. */
	paceKgPerWeek: number | null
}

export interface CalculateGoalsSteps {
	bmr: number
	activityMultiplier: number
	tdee: number
	/** Signed: negative for LOSE, positive for GAIN, 0 for MAINTAIN. */
	adjustmentKcal: number
	/** Before the rounding step and the floor. */
	rawKcal: number
}

export interface MacroGoals {
	proteinG: number
	carbsG: number
	fatG: number
}

export interface CalculateGoalsResult extends MacroGoals {
	kcal: number
	/** The pace actually used after the 1 % limit; null for MAINTAIN. */
	appliedPaceKgPerWeek: number | null
	/** Weeks to the target weight at the applied pace; null without a target or for MAINTAIN. */
	etaWeeks: number | null
	warnings: GoalWarning[]
	steps: CalculateGoalsSteps
}

const roundTo = (value: number, step: number): number => Math.round(value / step) * step
const floorTo = (value: number, step: number): number => Math.floor(value / step) * step
/** Avoids 0.1 + 0.2 artefacts in values shown to the user. */
const roundDecimals = (value: number, decimals: number): number => Number(value.toFixed(decimals))

const getBmr = ({ sex, age, heightCm, weightKg }: CalculateGoalsInput): number =>
	10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'MALE' ? 5 : -161)

/** Largest pace option within 1 % of the weight; the smallest option when even it is too fast. */
const limitPace = (pace: number, weightKg: number): number => {
	const maxPace = weightKg * MAX_PACE_SHARE_OF_WEIGHT
	if (pace <= maxPace) return pace
	const fitting = PACE_OPTIONS_KG_PER_WEEK.filter((option) => option <= maxPace)
	return fitting.at(-1) ?? PACE_OPTIONS_KG_PER_WEEK[0]
}

const getPaceSign = (goalType: GoalType): number => {
	if (goalType === 'LOSE') return -1
	if (goalType === 'GAIN') return 1
	return 0
}

export const getMacroKcal = ({ proteinG, carbsG, fatG }: MacroGoals): number =>
	proteinG * KCAL_PER_GRAM.protein + carbsG * KCAL_PER_GRAM.carbs + fatG * KCAL_PER_GRAM.fat

/** The «З Б/В/Ж виходить ≈ N ккал» check of manual goals. */
export const isGoalConsistent = (kcal: number, macros: MacroGoals): boolean =>
	Math.abs(getMacroKcal(macros) - kcal) <= kcal * MANUAL_GOALS_TOLERANCE

interface MacroResult extends MacroGoals {
	isAdjusted: boolean
}

/**
 * Protein and fat per kg; carbs take the remaining calories. When fewer than CARBS_MIN_G are left,
 * fat goes down (to FAT_MIN_G_PER_KG at the lowest); if that still isn't enough, carbs stay at what
 * is left (never below 0) and the result is flagged.
 */
const getMacros = (
	kcal: number,
	{ weightKg, targetWeightKg }: CalculateGoalsInput,
): MacroResult => {
	const proteinG = Math.round(PROTEIN_G_PER_KG_TARGET * (targetWeightKg ?? weightKg))
	const getCarbsLeft = (fatG: number): number =>
		(kcal - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat) / KCAL_PER_GRAM.carbs

	let fatG = Math.round(FAT_G_PER_KG * weightKg)
	if (getCarbsLeft(fatG) < CARBS_MIN_G) {
		const fatForMinCarbs = Math.floor(
			(kcal - proteinG * KCAL_PER_GRAM.protein - CARBS_MIN_G * KCAL_PER_GRAM.carbs) /
				KCAL_PER_GRAM.fat,
		)
		fatG = Math.max(fatForMinCarbs, Math.round(FAT_MIN_G_PER_KG * weightKg))
	}

	const carbsLeft = getCarbsLeft(fatG)
	const isAdjusted = carbsLeft < CARBS_MIN_G
	return {
		proteinG,
		fatG,
		carbsG: roundTo(Math.max(carbsLeft, 0), CARBS_ROUNDING_STEP),
		isAdjusted,
	}
}

/** Pure: the caller validates the input (zod in schemas/profile.ts) and supplies the age. */
export const calculateGoals = (input: CalculateGoalsInput): CalculateGoalsResult => {
	const warnings: GoalWarning[] = []
	const { goalType, weightKg, targetWeightKg, activityLevel } = input

	const bmr = getBmr(input)
	const activityMultiplier = ACTIVITY_MULTIPLIERS[activityLevel]
	const tdee = bmr * activityMultiplier

	const sign = getPaceSign(goalType)
	const requestedPace = sign === 0 ? null : input.paceKgPerWeek
	const appliedPaceKgPerWeek = requestedPace === null ? null : limitPace(requestedPace, weightKg)
	if (requestedPace !== null && appliedPaceKgPerWeek !== requestedPace)
		warnings.push('PACE_LIMITED')

	const adjustmentKcal =
		appliedPaceKgPerWeek === null
			? 0
			: (sign * appliedPaceKgPerWeek * KCAL_PER_KG_BODY_FAT) / DAYS_PER_WEEK
	const rawKcal = tdee + adjustmentKcal

	let kcal = floorTo(rawKcal, KCAL_ROUNDING_STEP)
	const floor = KCAL_FLOOR[input.sex]
	if (kcal < floor) {
		kcal = floor
		warnings.push('KCAL_FLOOR_APPLIED')
	}

	const { proteinG, carbsG, fatG, isAdjusted } = getMacros(kcal, input)
	if (isAdjusted) warnings.push('MACROS_ADJUSTED')

	// only a target on the goal's side of the current weight has an eta
	const weightToGo = targetWeightKg === null ? 0 : (targetWeightKg - weightKg) * sign
	const etaWeeks =
		appliedPaceKgPerWeek === null || weightToGo <= 0
			? null
			: Math.ceil(weightToGo / appliedPaceKgPerWeek)

	return {
		kcal,
		proteinG,
		carbsG,
		fatG,
		appliedPaceKgPerWeek,
		etaWeeks,
		warnings,
		steps: {
			bmr: roundDecimals(bmr, 1),
			activityMultiplier,
			tdee: roundDecimals(tdee, 1),
			adjustmentKcal: roundDecimals(adjustmentKcal, 1),
			rawKcal: roundDecimals(rawKcal, 1),
		},
	}
}
