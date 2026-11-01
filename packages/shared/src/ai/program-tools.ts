// The propose_program tool: the whole training program, new or changed. Nothing is saved until the
// user accepts the card; the backend turns refs into keys and ids and counts the estimate.
// After any change here: run `pnpm --filter ai-eval eval` and add a line to PROMPT_CHANGELOG.md.
import { z } from 'zod'

import { exerciseKindSchema, muscleGroupSchema } from '../schemas/enums.js'
import {
	PROGRAM_DISTANCE_M_MAX,
	PROGRAM_DURATION_MIN_MAX,
	PROGRAM_EXERCISES_PER_TEMPLATE_MAX,
	PROGRAM_NAME_MAX_LENGTH,
	PROGRAM_REPS_MAX,
	PROGRAM_REPS_MIN,
	PROGRAM_REST_SEC_MAX,
	PROGRAM_REST_SEC_MIN,
	PROGRAM_SETS_MAX,
	PROGRAM_SETS_MIN,
	PROGRAM_WEIGHT_KG_MAX,
	WEEKDAY_ISO_MAX,
	WEEKDAY_ISO_MIN,
} from '../schemas/programs.js'
import { EXERCISE_REF_PATTERN, TEMPLATE_REF_PATTERN } from './workout-tools.js'

const M_PER_KM = 1000
export const PROGRAM_DISTANCE_KM_MAX = PROGRAM_DISTANCE_M_MAX / M_PER_KM

const nullableInt = (min: number, max: number) => z.int().min(min).max(max).nullable().default(null)

// descriptions only where c6 §2.2 gives them; the rules live in «Program» of the context
export const programExerciseInputSchema = z.object({
	name: z.string().trim().min(1).max(PROGRAM_NAME_MAX_LENGTH),
	exerciseRef: z.string().regex(EXERCISE_REF_PATTERN).nullable().default(null),
	kind: exerciseKindSchema,
	muscleGroup: muscleGroupSchema.nullable().default(null),
	sets: nullableInt(PROGRAM_SETS_MIN, PROGRAM_SETS_MAX),
	repsMin: nullableInt(PROGRAM_REPS_MIN, PROGRAM_REPS_MAX),
	repsMax: nullableInt(PROGRAM_REPS_MIN, PROGRAM_REPS_MAX),
	weightKg: z
		.number()
		.min(0)
		.max(PROGRAM_WEIGHT_KG_MAX)
		.nullable()
		.default(null)
		.describe('Only if the user named it or it is in the exercise history'),
	restSec: nullableInt(PROGRAM_REST_SEC_MIN, PROGRAM_REST_SEC_MAX),
	durationMin: nullableInt(1, PROGRAM_DURATION_MIN_MAX),
	distanceKm: z.number().positive().max(PROGRAM_DISTANCE_KM_MAX).nullable().default(null),
})

export type ProgramExerciseInput = z.infer<typeof programExerciseInputSchema>

export const programTemplateInputSchema = z.object({
	ref: z
		.string()
		.regex(TEMPLATE_REF_PATTERN)
		.nullable()
		.default(null)
		.describe('t-ref from "Program" for an existing template'),
	name: z.string().trim().min(1).max(PROGRAM_NAME_MAX_LENGTH),
	weekdays: z
		.array(z.int().min(WEEKDAY_ISO_MIN).max(WEEKDAY_ISO_MAX))
		.max(WEEKDAY_ISO_MAX)
		.default([])
		.describe('ISO weekdays 1–7, only for mode WEEKDAYS'),
	exercises: z.array(programExerciseInputSchema).min(1).max(PROGRAM_EXERCISES_PER_TEMPLATE_MAX),
})

export type ProgramTemplateInput = z.infer<typeof programTemplateInputSchema>
