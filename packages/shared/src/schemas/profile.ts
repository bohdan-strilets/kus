import { z } from 'zod'

import { GOAL_WARNINGS, PACE_OPTIONS_KG_PER_WEEK } from '../goals/calculate-goals.js'
import { activityLevelSchema, goalSourceSchema, goalTypeSchema, sexSchema } from './enums.js'
import { GOAL_KCAL, GOAL_MACRO_GRAMS } from './goals.js'

export const PROFILE_LIMITS = {
	age: { min: 18, max: 100 },
	heightCm: { min: 120, max: 230 },
	weightKg: { min: 30, max: 300 },
} as const

/** The four levels of «Активність» (onboarding-3-activity); VERY_ACTIVE exists only in the DB. */
export const profileActivityLevelSchema = z.enum(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE'])
export type ProfileActivityLevel = z.infer<typeof profileActivityLevelSchema>

export const paceKgPerWeekSchema = z.literal([...PACE_OPTIONS_KG_PER_WEEK])

const weightKgSchema = z.number().min(PROFILE_LIMITS.weightKg.min).max(PROFILE_LIMITS.weightKg.max)

/**
 * Body of PATCH /profile: every field optional, at least one present. `age` is stored as a birth
 * year; `weightKg` becomes today's weigh-in. MAINTAIN clears the pace on the server.
 */
export const updateProfileRequestSchema = z
	.object({
		sex: sexSchema.optional(),
		// adults only: a dedicated code, so the form can say why instead of «too small»
		age: z
			.number()
			.int()
			.max(PROFILE_LIMITS.age.max)
			.refine((age) => age >= PROFILE_LIMITS.age.min, { message: 'AGE_BELOW_MINIMUM' })
			.optional(),
		heightCm: z
			.number()
			.int()
			.min(PROFILE_LIMITS.heightCm.min)
			.max(PROFILE_LIMITS.heightCm.max)
			.optional(),
		weightKg: weightKgSchema.optional(),
		/** null clears it; protein is then sized to the current weight. */
		targetWeightKg: weightKgSchema.nullable().optional(),
		activityLevel: profileActivityLevelSchema.optional(),
		goalType: goalTypeSchema.optional(),
		paceKgPerWeek: paceKgPerWeekSchema.nullable().optional(),
	})
	// unknown keys are stripped before this runs, so any key left is a real field
	.refine((body) => Object.keys(body).length > 0, { message: 'EMPTY_UPDATE' })

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>

/** The goal in force today, as the profile shows it. */
export const profileGoalsSchema = z.object({
	kcal: z.number(),
	proteinG: z.number(),
	carbsG: z.number(),
	fatG: z.number(),
	source: goalSourceSchema,
	/** The day the goal started (the user's calendar day). */
	validFrom: z.iso.date(),
	updatedAt: z.iso.datetime(),
})

export type ProfileGoals = z.infer<typeof profileGoalsSchema>

export const profileResponseSchema = z.object({
	email: z.email(),
	name: z.string().nullable(),
	addressAs: z.string().nullable(),
	profile: z.object({
		sex: sexSchema.nullable(),
		/** Current local year minus the birth year. */
		age: z.number().int().nullable(),
		heightCm: z.number().nullable(),
		activityLevel: activityLevelSchema.nullable(),
		targetWeightKg: z.number().nullable(),
		goalType: goalTypeSchema.nullable(),
		paceKgPerWeek: z.number().nullable(),
	}),
	/** The latest weigh-in («вага зараз»). */
	weight: z.object({ kg: z.number(), localDate: z.iso.date() }).nullable(),
	goals: profileGoalsSchema.nullable(),
})

export type ProfileResponse = z.infer<typeof profileResponseSchema>

export const goalWarningSchema = z.enum(GOAL_WARNINGS)

/** POST /profile/goals/preview: the calculation without saving, plus the goal it would replace. */
export const goalsPreviewResponseSchema = z.object({
	kcal: z.number(),
	proteinG: z.number(),
	carbsG: z.number(),
	fatG: z.number(),
	appliedPaceKgPerWeek: z.number().nullable(),
	etaWeeks: z.number().nullable(),
	warnings: z.array(goalWarningSchema),
	steps: z.object({
		bmr: z.number(),
		activityMultiplier: z.number(),
		tdee: z.number(),
		adjustmentKcal: z.number(),
		rawKcal: z.number(),
	}),
	current: profileGoalsSchema.nullable(),
})

export type GoalsPreviewResponse = z.infer<typeof goalsPreviewResponseSchema>

const macroGramsSchema = z.number().int().min(GOAL_MACRO_GRAMS.min).max(GOAL_MACRO_GRAMS.max)

export const saveGoalsSourceSchema = z.enum(['calculated', 'manual'])

export const MANUAL_GOAL_FIELDS = ['kcal', 'proteinG', 'carbsG', 'fatG'] as const

/** The numbers of a manual goal, as typed in goals-edit-sheet. */
export interface ManualGoals {
	kcal: number
	proteinG: number
	carbsG: number
	fatG: number
}

/**
 * Body of PUT /profile/goals. `calculated`: the server computes from the profile (client numbers
 * are never trusted). `manual`: the four numbers are required and the server checks they add up.
 * One object, not a union: the nestjs-zod DTO needs an object type; the refine does the rest.
 */
export const saveGoalsRequestSchema = z
	.object({
		source: saveGoalsSourceSchema,
		kcal: z.number().int().min(GOAL_KCAL.min).max(GOAL_KCAL.max).optional(),
		proteinG: macroGramsSchema.optional(),
		carbsG: macroGramsSchema.optional(),
		fatG: macroGramsSchema.optional(),
	})
	.superRefine((body, context) => {
		if (body.source !== 'manual') return
		for (const field of MANUAL_GOAL_FIELDS) {
			if (body[field] === undefined) {
				context.addIssue({ code: 'custom', path: [field], message: 'REQUIRED' })
			}
		}
	})

export type SaveGoalsRequest = z.infer<typeof saveGoalsRequestSchema>

export type ManualGoalsRequest = ManualGoals & { source: 'manual' }

/** Sound only for a body the schema has validated: the refine guarantees the four numbers. */
export const isManualGoalsRequest = (body: SaveGoalsRequest): body is ManualGoalsRequest =>
	body.source === 'manual'
