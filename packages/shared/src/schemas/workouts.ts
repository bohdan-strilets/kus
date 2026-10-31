import { z } from 'zod'

import { countRangeDays } from './date-range.js'
import {
	exerciseKindSchema,
	exerciseSourceSchema,
	muscleGroupSchema,
	workoutPlaceSchema,
} from './enums.js'

/** A tab of history reads a quarter at most. */
export const WORKOUTS_RANGE_MAX_DAYS = 93

export const workoutRecordTypeSchema = z.enum(['WEIGHT', 'DISTANCE', 'REPS'])

export type WorkoutRecordType = z.infer<typeof workoutRecordTypeSchema>

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
	/** The main group of a strength exercise; null for cardio and when it is unknown. */
	muscleGroup: muscleGroupSchema.nullable().default(null),
	/**
	 * ISO: when the exercise was logged (noon of the day for a past day). The backend always sends it;
	 * null only in a response cached before 0.10.0.
	 */
	performedAt: z.iso.datetime().nullable().default(null),
	sets: z.array(workoutSetResponseSchema),
	/**
	 * WEIGHT: a heavier set than ever before; DISTANCE: a longer one; REPS: more reps in a set without
	 * weight. null: no record (a first result is none). A type this client does not know reads as
	 * null, so a newer backend never breaks it.
	 */
	record: workoutRecordTypeSchema.nullable().catch(null),
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
	/** A later message replaced the whole workout («· змінено»). */
	isEdited: z.boolean().default(false),
	/** Deleted: the chat card turns into the line «Тренування 26.10 видалено.»; lists never contain it. */
	isDeleted: z.boolean().default(false),
	/** When the session was finished («все»); null while it is open. */
	finishedAt: z.iso.datetime().nullable().default(null),
	/**
	 * Minutes from the first logged exercise to the finish (or the last exercise) when no duration was
	 * named and the session spans at least 10 minutes — the UI shows «≈ N хв»; null otherwise.
	 */
	estimatedDurationMin: z.number().nullable().default(null),
	exercises: z.array(workoutExerciseResponseSchema),
})

export type WorkoutResponse = z.infer<typeof workoutResponseSchema>

/**
 * SUMMARY: the message finished the session (or told it whole) — the card of the whole session.
 * EXERCISES: the message added these exercises to a session — a card per exercise.
 */
export const workoutCardVariantSchema = z.enum(['SUMMARY', 'EXERCISES'])

export type WorkoutCardVariant = z.infer<typeof workoutCardVariantSchema>

/** How one workout of `workouts` shows on a message. */
export const workoutCardSchema = z.object({
	workoutId: z.uuid(),
	variant: workoutCardVariantSchema,
	/** The exercises the card shows: those the message added, or the whole session for SUMMARY. */
	exerciseIds: z.array(z.uuid()),
})

export type WorkoutCard = z.infer<typeof workoutCardSchema>

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
