// The log_workout tool: a training session with its exercises and sets. The model points at
// today's workouts and the user's exercise dictionary by refs (`w1`, `x1`), never database ids.
// After any change here: run `pnpm --filter ai-eval eval` and add a line to PROMPT_CHANGELOG.md.
import { z } from 'zod'

import { exerciseKindSchema, muscleGroupSchema } from '../schemas/enums.js'

/** Refs the backend gives today's workouts and the dictionary exercises named in the message. */
export const WORKOUT_REF_PATTERN = /^w\d{1,3}$/
export const EXERCISE_REF_PATTERN = /^x\d{1,3}$/

/** A group fix of an exercise from «Exercises»: `x1:LEGS`. Only the format, to keep the prefix short; the parser checks the group. */
export const EXERCISE_GROUP_FIX_PATTERN = /^x\d+:[A-Z]+$/

/** Delete and restore point at an entry (`e3`) or a workout (`w1`). */
export const ENTRY_OR_WORKOUT_REF_PATTERN = /^[ew]\d{1,3}$/

export const MAX_WORKOUTS_PER_MESSAGE = 3
export const MAX_EXERCISES_PER_WORKOUT = 15
export const MAX_SET_GROUPS_PER_EXERCISE = 20
/** Sets of one exercise after the groups are expanded. */
export const MAX_SETS_PER_EXERCISE = 60
export const MAX_WORKOUT_MINUTES = 600
export const MAX_WORKOUT_KCAL = 5000
export const MAX_SET_REPS = 200
export const MAX_SET_WEIGHT_KG = 500
export const MAX_DISTANCE_KM = 500
const MAX_SET_COUNT = 30
const MAX_EXERCISE_NAME_LENGTH = 80

export const workoutSetSchema = z.object({
	reps: z
		.int()
		.min(1)
		.max(MAX_SET_REPS)
		.nullable()
		.default(null)
		.describe('Per set; null if not said'),
	weightKg: z
		.number()
		.min(0)
		.max(MAX_SET_WEIGHT_KG)
		.nullable()
		.default(null)
		.describe('Bar or machine kg, not food; null if none'),
	count: z.int().min(1).max(MAX_SET_COUNT).default(1).describe('Sets in this group'),
	isWarmup: z.boolean().default(false).describe('Warm-up set'),
})

export type WorkoutSetInput = z.infer<typeof workoutSetSchema>

export const workoutExerciseSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1)
		.max(MAX_EXERCISE_NAME_LENGTH)
		.describe('The user\'s words, nominative, e.g. "Жим лежачи"'),
	exerciseRef: z
		.string()
		.regex(EXERCISE_REF_PATTERN)
		.nullable()
		.default(null)
		.describe('x-ref from "Exercises" if the same exercise; else null'),
	kind: exerciseKindSchema.describe(
		'STRENGTH: sets. CARDIO: minutes or distance. OTHER: anything else',
	),
	// no description: the rule lives in "Workouts" of the prompt
	muscleGroup: muscleGroupSchema.nullable().default(null),
	sets: z
		.array(workoutSetSchema)
		.max(MAX_SET_GROUPS_PER_EXERCISE)
		.default([])
		.describe('"3×8 80" → {reps 8, weightKg 80, count 3}; "8, 8, 6 по 80" → two groups'),
	durationMin: z
		.int()
		.min(1)
		.max(MAX_WORKOUT_MINUTES)
		.nullable()
		.default(null)
		.describe('Cardio minutes; else null'),
	distanceKm: z
		.number()
		.positive()
		.max(MAX_DISTANCE_KM)
		.nullable()
		.default(null)
		.describe('Km; else null'),
})

export type WorkoutExerciseInput = z.infer<typeof workoutExerciseSchema>

/** Sets of an exercise with every group expanded: «3×8 80» is three sets. */
export const countSets = (exercise: Pick<WorkoutExerciseInput, 'sets'>): number =>
	exercise.sets.reduce((total, group) => total + group.count, 0)
