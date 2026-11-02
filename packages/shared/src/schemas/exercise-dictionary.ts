import { z } from 'zod'

import { TRAINING_GROUP_ORDER } from '../workouts/muscle-groups.js'
import { exerciseKindSchema, muscleGroupSchema } from './enums.js'
import { programLastSetSchema } from './programs-api.js'
import { PROGRAM_NAME_MAX_LENGTH } from './programs.js'

/** Query of GET /workouts/exercises: a part of the name and/or one group («Кардіо» is the kind). */
export const exerciseDictionaryQuerySchema = z.object({
	query: z.string().trim().max(PROGRAM_NAME_MAX_LENGTH).optional(),
	group: z.enum(TRAINING_GROUP_ORDER).optional(),
})
export type ExerciseDictionaryQuery = z.infer<typeof exerciseDictionaryQuerySchema>

/** An exercise of the user's dictionary with the sets of the last time it was done. */
export const exerciseDictionaryItemSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	kind: exerciseKindSchema,
	muscleGroup: muscleGroupSchema.nullable(),
	/** Null when the user never did the exercise. */
	lastSets: z.array(programLastSetSchema).nullable(),
	/** Cardio only: the last result; null for other kinds and when it never happened. */
	lastCardio: z
		.object({ durationMin: z.number().int().nullable(), distanceM: z.number().int().nullable() })
		.nullable(),
})
export type ExerciseDictionaryItem = z.infer<typeof exerciseDictionaryItemSchema>

export const exerciseDictionaryResponseSchema = z.array(exerciseDictionaryItemSchema)
export type ExerciseDictionaryResponse = z.infer<typeof exerciseDictionaryResponseSchema>

/** The most rows one answer carries; the search narrows the rest. */
export const EXERCISE_DICTIONARY_LIMIT = 50
