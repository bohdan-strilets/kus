import { z } from 'zod'

import { loggedMealSchema, nutritionTotalsSchema } from './messages.js'

/** `:localDate` of GET /days/:localDate — the user's calendar day. */
export const dayParamsSchema = z.object({ localDate: z.iso.date() })

export type DayParams = z.infer<typeof dayParamsSchema>

export const dailyGoalSchema = z.object({
	kcal: z.number(),
	protein: z.number(),
	carbs: z.number(),
	fat: z.number(),
})

export type DailyGoal = z.infer<typeof dailyGoalSchema>

/** A day as «Сьогодні» and the chat header show it; every number is summed by the backend. */
export const dayResponseSchema = z.object({
	localDate: z.iso.date(),
	/** In the day's course: breakfast → lunch → snack → dinner; each with all of its entries. */
	meals: z.array(loggedMealSchema),
	totals: nutritionTotalsSchema,
	goal: dailyGoalSchema.nullable(),
	/** Negative when over the goal; null without a goal. */
	remainingKcal: z.number().nullable(),
})

export type DayResponse = z.infer<typeof dayResponseSchema>
