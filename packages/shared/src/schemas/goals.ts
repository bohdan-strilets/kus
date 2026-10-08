import { z } from 'zod'

/** Below ~800 kcal a day is an extreme deficit (CLAUDE.md §6); above 6000 — a typo. */
export const GOAL_KCAL = { min: 800, max: 6000 } as const
export const GOAL_MACRO_GRAMS = { min: 0, max: 600 } as const

const macroSchema = z.number().int().min(GOAL_MACRO_GRAMS.min).max(GOAL_MACRO_GRAMS.max)

/** Body of PUT /goals/current: today's goal, in force from today on. */
export const setGoalRequestSchema = z.object({
	kcal: z.number().int().min(GOAL_KCAL.min).max(GOAL_KCAL.max),
	protein: macroSchema,
	carbs: macroSchema,
	fat: macroSchema,
})

export type SetGoalRequest = z.infer<typeof setGoalRequestSchema>
