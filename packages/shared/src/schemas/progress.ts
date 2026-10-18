import { z } from 'zod'

import { dayStatusSchema } from './days.js'
import { goalTypeSchema } from './enums.js'
import { measurementChartPointSchema } from './measurements.js'

export const PROGRESS_RANGES = [7, 30, 90] as const
export const DEFAULT_PROGRESS_RANGE = 7

/** Query of GET /progress. The range drives only weight and waist; the week card is always 7 days. */
export const progressQuerySchema = z.object({
	range: z.coerce
		.number()
		.pipe(z.literal([...PROGRESS_RANGES]))
		.default(DEFAULT_PROGRESS_RANGE),
})

export type ProgressQuery = z.infer<typeof progressQuerySchema>

const progressMeasurementCurrentSchema = z.object({
	value: z.number(),
	localDate: z.iso.date(),
})

/** Waist, or the common part of weight: the latest value, the change over the range and its points. */
export const progressWaistSchema = z.object({
	current: progressMeasurementCurrentSchema,
	/** Change over the selected range; null with a single point. */
	changeInRange: z.number().nullable(),
	points: z.array(measurementChartPointSchema),
})

export type ProgressWaist = z.infer<typeof progressWaistSchema>

export const progressWeightSchema = progressWaistSchema.extend({
	target: z.number().nullable(),
	/** Kg left in the direction of the goal, never negative (0 once reached); null without a target and for MAINTAIN. */
	toGoal: z.number().nullable(),
	isGoalReached: z.boolean().nullable(),
	/**
	 * The first weigh-in that is not deleted, by the time it was written (a backdated entry does not
	 * move it). Absent in answers of an older API, read as null.
	 */
	start: progressMeasurementCurrentSchema.nullable().default(null),
	/** Current minus the start; null without a start, and when the start is the current value. */
	fromStart: z.number().nullable().default(null),
})

export type ProgressWeight = z.infer<typeof progressWeightSchema>

/** A day of the week card; averages count only days with entries. */
export const progressWeekDaySchema = z.object({
	localDate: z.iso.date(),
	kcal: z.number(),
	proteinG: z.number(),
	status: dayStatusSchema,
})

export type ProgressWeekDay = z.infer<typeof progressWeekDaySchema>

/** Always the last 7 days, whatever `range` is. */
export const progressWeekSchema = z.object({
	days: z.array(progressWeekDaySchema),
	goalKcal: z.number().nullable(),
	avgKcal: z.number().nullable(),
	avgProteinG: z.number().nullable(),
})

export type ProgressWeek = z.infer<typeof progressWeekSchema>

/** Facts only — the sentence is an i18n template on the frontend. */
export const progressInsightSchema = z.object({
	weekPaceKg: z.number().nullable(),
	planPaceKgPerWeek: z.number().nullable(),
	goalType: goalTypeSchema.nullable(),
	overDays: z.number().int().min(0),
	isWeekendProteinLow: z.boolean(),
})

export type ProgressInsight = z.infer<typeof progressInsightSchema>

export const progressResponseSchema = z.object({
	range: z.literal([...PROGRESS_RANGES]),
	from: z.iso.date(),
	to: z.iso.date(),
	isEmpty: z.boolean(),
	weight: progressWeightSchema.nullable(),
	waist: progressWaistSchema.nullable(),
	week: progressWeekSchema,
	insight: progressInsightSchema,
})

export type ProgressResponse = z.infer<typeof progressResponseSchema>
