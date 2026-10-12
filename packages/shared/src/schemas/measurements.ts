import { z } from 'zod'

import { type GoalType, measurementKindSchema, measurementSourceSchema } from './enums.js'

/** WEIGHT in kg, WAIST in cm. */
export const MEASUREMENT_LIMITS = {
	WEIGHT: { min: 30, max: 300 },
	WAIST: { min: 40, max: 200 },
} as const

/** A card's mini chart shows at most this many weekly points. */
export const MEASUREMENT_CHART_MAX_POINTS = 5

export const measurementResponseSchema = z.object({
	id: z.uuid(),
	kind: measurementKindSchema,
	value: z.number(),
	localDate: z.iso.date(),
	source: measurementSourceSchema,
})

export type MeasurementResponse = z.infer<typeof measurementResponseSchema>

export const measurementChartPointSchema = z.object({
	localDate: z.iso.date(),
	value: z.number(),
})

export type MeasurementChartPoint = z.infer<typeof measurementChartPointSchema>

/**
 * A measurement as the chat card shows it — a snapshot at the moment of the weigh-in. Every number
 * is computed by the backend; the nullable ones are null when there is nothing to compare with.
 */
export const measurementCardSchema = measurementResponseSchema.extend({
	/** Current minus the first weigh-in of this kind. */
	fromStart: z.number().nullable(),
	/** Kg left in the direction of the goal, never negative (0 once reached or passed); null for WAIST, without a target, and for MAINTAIN. */
	toGoal: z.number().nullable(),
	/** Target reached or passed in the goal direction (see getIsGoalReached); null without a direction. */
	isGoalReached: z.boolean().nullable(),
	/** Change over the last week. */
	weekChange: z.number().nullable(),
	planPaceKgPerWeek: z.number().nullable(),
	chart: z.array(measurementChartPointSchema).max(MEASUREMENT_CHART_MAX_POINTS),
})

export type MeasurementCard = z.infer<typeof measurementCardSchema>

/**
 * Whether the target weight is reached, by the direction of the goal: LOSE — at or below it,
 * GAIN — at or above it. MAINTAIN or no goal or no target: null, there is nothing to reach.
 */
export const getIsGoalReached = ({
	goalType,
	current,
	target,
}: {
	goalType: GoalType | null
	current: number
	target: number | null
}): boolean | null => {
	if (target === null) return null
	if (goalType === 'LOSE') return current <= target
	if (goalType === 'GAIN') return current >= target
	return null
}
