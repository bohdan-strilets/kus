import { z } from 'zod'

import { exerciseKindSchema, muscleGroupSchema } from './enums.js'
import { workoutSetResponseSchema } from './workouts.js'

export const WORKOUT_STATS_PERIODS = ['week', 'month', 'quarter'] as const

export const workoutStatsPeriodSchema = z.enum(WORKOUT_STATS_PERIODS)

export type WorkoutStatsPeriod = z.infer<typeof workoutStatsPeriodSchema>

/** Query of GET /workouts/stats and GET /workouts/exercises/:exerciseId. */
export const workoutStatsQuerySchema = z.object({ period: workoutStatsPeriodSchema })

export type WorkoutStatsQuery = z.infer<typeof workoutStatsQuerySchema>

/** Path of GET /workouts/exercises/:exerciseId. */
export const exerciseStatsParamsSchema = z.object({ exerciseId: z.uuid() })

export type ExerciseStatsParams = z.infer<typeof exerciseStatsParamsSchema>

const dateRangeSchema = z.object({ from: z.iso.date(), to: z.iso.date() })

/** A set of a bodyweight exercise has no weight: `weightKg` is null there. */
export const workoutStatsTopSetSchema = z.object({
	weightKg: z.number().nullable(),
	reps: z.number(),
	localDate: z.iso.date(),
})

export type WorkoutStatsTopSet = z.infer<typeof workoutStatsTopSetSchema>

export const workoutStatsBucketSchema = z.object({
	from: z.iso.date(),
	to: z.iso.date(),
	workoutCount: z.number(),
	setCount: z.number(),
	cardioMin: z.number(),
})

export type WorkoutStatsBucket = z.infer<typeof workoutStatsBucketSchema>

export const workoutStatsGroupSchema = z.object({
	/** null: the exercise has no group («Інше»). */
	muscleGroup: muscleGroupSchema.nullable(),
	setCount: z.number(),
})

export type WorkoutStatsGroup = z.infer<typeof workoutStatsGroupSchema>

export const workoutStatsOverviewSchema = z.object({
	workoutCount: z.number(),
	workoutCountPrev: z.number(),
	/** Strength only, warm-up sets are not counted. */
	exerciseCount: z.number(),
	setCount: z.number(),
	durationMin: z.number(),
	avgDurationMin: z.number().nullable(),
	/** At least one workout had no named duration, so the sum includes an estimate («≈»). */
	hasEstimatedDuration: z.boolean(),
	/** Only kcal the user named or a device showed. */
	kcal: z.object({
		total: z.number().nullable(),
		workoutsWithKcal: z.number(),
		workoutCount: z.number(),
	}),
	buckets: z.array(workoutStatsBucketSchema),
	groups: z.array(workoutStatsGroupSchema),
})

export const workoutStatsExerciseSchema = z.object({
	exerciseId: z.uuid(),
	name: z.string(),
	muscleGroup: muscleGroupSchema.nullable(),
	isBodyweight: z.boolean(),
	sessionCount: z.number(),
	setCount: z.number(),
	lastLocalDate: z.iso.date(),
	/** Over all time: the heaviest working set, or the most reps for a bodyweight exercise. */
	best: workoutStatsTopSetSchema.nullable(),
	/** Last point of the period minus the first; null with fewer than two points. */
	change: z.number().nullable(),
	/** Points of the period, oldest first: top working weight (max reps for bodyweight). */
	trend: z.array(z.number()),
})

export type WorkoutStatsExercise = z.infer<typeof workoutStatsExerciseSchema>

export const workoutStatsCardioBucketSchema = z.object({
	from: z.iso.date(),
	to: z.iso.date(),
	minutes: z.number(),
})

export const workoutStatsCardioExerciseSchema = z.object({
	exerciseId: z.uuid(),
	name: z.string(),
	sessionCount: z.number(),
	durationMin: z.number(),
	distanceM: z.number().nullable(),
})

export const workoutStatsResponseSchema = z.object({
	period: workoutStatsPeriodSchema,
	from: z.iso.date(),
	to: z.iso.date(),
	previous: dateRangeSchema,
	overview: workoutStatsOverviewSchema,
	exercises: z.array(workoutStatsExerciseSchema),
	cardio: z.object({
		sessionCount: z.number(),
		durationMin: z.number(),
		distanceM: z.number(),
		buckets: z.array(workoutStatsCardioBucketSchema),
		byExercise: z.array(workoutStatsCardioExerciseSchema),
	}),
})

export type WorkoutStatsResponse = z.infer<typeof workoutStatsResponseSchema>

export const exerciseStatsResponseSchema = z.object({
	exercise: z.object({
		id: z.uuid(),
		name: z.string(),
		kind: exerciseKindSchema,
		muscleGroup: muscleGroupSchema.nullable(),
		isBodyweight: z.boolean(),
	}),
	/** Over all time, not the period. */
	best: z.object({
		/** The heaviest working set; for a bodyweight exercise the set with the most reps. */
		topSet: workoutStatsTopSetSchema.nullable(),
		/** Weighted: the most reps at the heaviest working weight; bodyweight: the most reps in a set. */
		maxReps: workoutStatsTopSetSchema.nullable(),
		/** Bodyweight only: the most reps in one workout; null for a weighted exercise. */
		maxSessionReps: z.object({ reps: z.number(), localDate: z.iso.date() }).nullable(),
	}),
	/** Last point of the period minus the first; null with fewer than two points. */
	change: z.number().nullable(),
	points: z.array(
		z.object({
			localDate: z.iso.date(),
			workoutId: z.uuid(),
			topWeightKg: z.number().nullable(),
			maxReps: z.number().nullable(),
		}),
	),
	/** The last 20 workouts with this exercise, newest first. */
	history: z.array(
		z.object({
			workoutId: z.uuid(),
			localDate: z.iso.date(),
			sets: z.array(workoutSetResponseSchema),
		}),
	),
})

export type ExerciseStatsResponse = z.infer<typeof exerciseStatsResponseSchema>
