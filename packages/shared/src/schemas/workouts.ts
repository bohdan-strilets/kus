import { z } from 'zod'

import { countRangeDays } from './days.js'
import { exerciseKindSchema, exerciseSourceSchema, workoutPlaceSchema } from './enums.js'

/** A tab of history reads a quarter at most. */
export const WORKOUTS_RANGE_MAX_DAYS = 93

export const workoutSetResponseSchema = z.object({
	reps: z.number().nullable(),
	/** The weight of the bar or machine in kg — never food. */
	weightKg: z.number().nullable(),
	durationSec: z.number().nullable(),
	distanceM: z.number().nullable(),
	isWarmup: z.boolean(),
})

export type WorkoutSetResponse = z.infer<typeof workoutSetResponseSchema>

export const workoutExerciseResponseSchema = z.object({
	id: z.uuid(),
	/** As the user wrote it. */
	name: z.string(),
	kind: exerciseKindSchema,
	durationMin: z.number().nullable(),
	distanceM: z.number().nullable(),
	sets: z.array(workoutSetResponseSchema),
})

export type WorkoutExerciseResponse = z.infer<typeof workoutExerciseResponseSchema>

/**
 * One training as the tab and the chat card show it. `kcalBurned` is only a number the user said
 * or a device showed; it never moves the calorie goal.
 */
export const workoutResponseSchema = z.object({
	id: z.uuid(),
	/** `YYYY-MM-DD`, the user's calendar day. */
	localDate: z.iso.date(),
	startedAt: z.iso.datetime().nullable(),
	durationMin: z.number().nullable(),
	place: workoutPlaceSchema.nullable(),
	kcalBurned: z.number().nullable(),
	kcalSource: exerciseSourceSchema.nullable(),
	exercises: z.array(workoutExerciseResponseSchema),
})

export type WorkoutResponse = z.infer<typeof workoutResponseSchema>

/** Path of the /workouts/:id routes. */
export const workoutParamsSchema = z.object({ id: z.uuid() })

export type WorkoutParams = z.infer<typeof workoutParamsSchema>

/** Path of GET /workouts/day/:localDate. */
export const workoutDayParamsSchema = z.object({ localDate: z.iso.date() })

/** Query of GET /workouts?from&to — `YYYY-MM-DD`, the user's calendar days, both included. */
export const workoutsRangeQuerySchema = z
	.object({ from: z.iso.date(), to: z.iso.date() })
	.superRefine(({ from, to }, context) => {
		if (from > to) context.addIssue({ code: 'custom', path: ['to'], message: 'BEFORE_FROM' })
		else if (countRangeDays(from, to) > WORKOUTS_RANGE_MAX_DAYS) {
			context.addIssue({ code: 'custom', path: ['to'], message: 'RANGE_TOO_LONG' })
		}
	})

export type WorkoutsRangeQuery = z.infer<typeof workoutsRangeQuerySchema>
