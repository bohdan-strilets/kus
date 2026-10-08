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

/** The week strip asks for 7 days; a month is the most a screen needs at once. */
export const DAYS_RANGE_MAX_DAYS = 31

const MS_IN_DAY = 24 * 60 * 60 * 1000

/** Days from `from` to `to`, both included. */
export const countRangeDays = (from: string, to: string): number =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_IN_DAY) + 1

/** Query of GET /days?from&to — `YYYY-MM-DD`, the user's calendar days. */
export const daysRangeQuerySchema = z
	.object({ from: z.iso.date(), to: z.iso.date() })
	.superRefine(({ from, to }, context) => {
		if (from > to) context.addIssue({ code: 'custom', path: ['to'], message: 'BEFORE_FROM' })
		else if (countRangeDays(from, to) > DAYS_RANGE_MAX_DAYS) {
			context.addIssue({ code: 'custom', path: ['to'], message: 'RANGE_TOO_LONG' })
		}
	})

export type DaysRangeQuery = z.infer<typeof daysRangeQuerySchema>

/**
 * Above this share of the goal a day is over it — the gauge's «over» and the strip's over dot
 * (design: the 97–103 % band counts as the goal closed).
 */
export const DAY_OVER_GOAL_RATIO = 1.03

/** empty — nothing logged; normal — logged and not over the goal (or no goal); over — over it. */
export const dayStatusSchema = z.enum(['empty', 'normal', 'over'])

export type DayStatus = z.infer<typeof dayStatusSchema>

export const getDayStatus = ({
	kcal,
	entryCount,
	goalKcal,
}: {
	kcal: number
	entryCount: number
	goalKcal: number | null
}): DayStatus => {
	if (entryCount === 0) return 'empty'
	return goalKcal !== null && goalKcal > 0 && kcal > goalKcal * DAY_OVER_GOAL_RATIO
		? 'over'
		: 'normal'
}

/** A day of the strip: what it summed to against the goal in force that day. */
export const dayInRangeSchema = z.object({
	localDate: z.iso.date(),
	kcal: z.number(),
	goalKcal: z.number().nullable(),
	status: dayStatusSchema,
})

export type DayInRange = z.infer<typeof dayInRangeSchema>
