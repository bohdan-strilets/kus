import { z } from 'zod'

import { exerciseKindSchema, muscleGroupSchema, programModeSchema } from './enums.js'
import {
	PROGRAM_EXERCISES_PER_TEMPLATE_MAX,
	PROGRAM_PER_WEEK_MAX,
	programChangesSchema,
	templateExerciseSchema,
	templateExerciseTargetSchema,
	weekdaysSchema,
} from './programs.js'

export const programLastSetSchema = z.object({
	reps: z.number().int().nullable(),
	weightKg: z.number().nullable(),
	isWarmup: z.boolean(),
})
export type ProgramLastSet = z.infer<typeof programLastSetSchema>

export const programExerciseResponseSchema = z.object({
	id: z.uuid(),
	exerciseId: z.uuid().nullable(),
	name: z.string(),
	kind: exerciseKindSchema,
	muscleGroup: muscleGroupSchema.nullable(),
	position: z.number().int(),
	target: templateExerciseTargetSchema,
	/** The sets of the last time the user did the exercise; null when they never did. */
	lastSets: z.array(programLastSetSchema).nullable(),
	lastPerformedAt: z.iso.datetime().nullable(),
})
export type ProgramExerciseResponse = z.infer<typeof programExerciseResponseSchema>

export const programTemplateResponseSchema = z.object({
	id: z.uuid(),
	key: z.uuid(),
	name: z.string(),
	position: z.number().int(),
	weekdays: z.array(z.number().int()),
	estimatedMin: z.number().int(),
	/** Unique, in exercise order, without cardio. */
	muscleGroups: z.array(muscleGroupSchema),
	hasCardio: z.boolean(),
	exercises: z.array(programExerciseResponseSchema),
})
export type ProgramTemplateResponse = z.infer<typeof programTemplateResponseSchema>

export const programNextResponseSchema = z.object({
	templateId: z.uuid(),
	/** ISO weekday; only in the WEEKDAYS mode. */
	weekday: z.number().int().nullable(),
	/** `YYYY-MM-DD`; only in the WEEKDAYS mode. */
	date: z.string().nullable(),
	isToday: z.boolean(),
})
export type ProgramNextResponse = z.infer<typeof programNextResponseSchema>

export const programResponseSchema = z.object({
	id: z.uuid(),
	title: z.string().nullable(),
	mode: programModeSchema,
	perWeek: z.number().int().nullable(),
	pinnedTemplateId: z.uuid().nullable(),
	version: z.object({ id: z.uuid(), createdAt: z.iso.datetime() }),
	templates: z.array(programTemplateResponseSchema),
	next: programNextResponseSchema.nullable(),
})
export type ProgramResponse = z.infer<typeof programResponseSchema>

export const programVersionItemSchema = z.object({
	id: z.uuid(),
	createdAt: z.iso.datetime(),
	isCurrent: z.boolean(),
	changes: programChangesSchema,
})
export type ProgramVersionItem = z.infer<typeof programVersionItemSchema>

export const programVersionListResponseSchema = z.array(programVersionItemSchema)
export type ProgramVersionListResponse = z.infer<typeof programVersionListResponseSchema>

export const updateProgramSettingsRequestSchema = z
	.object({
		mode: programModeSchema,
		pinnedTemplateId: z.uuid().nullable(),
		perWeek: z.number().int().min(1).max(PROGRAM_PER_WEEK_MAX).nullable(),
	})
	.partial()
	.refine((body) => Object.keys(body).length > 0, 'EMPTY_BODY')
export type UpdateProgramSettingsRequest = z.infer<typeof updateProgramSettingsRequestSchema>

export const updateTemplateScheduleRequestSchema = z.object({ weekdays: weekdaysSchema })
export type UpdateTemplateScheduleRequest = z.infer<typeof updateTemplateScheduleRequestSchema>

export const programTemplateParamsSchema = z.object({ templateId: z.uuid() })

/** «Готово» of the template editor: the whole list of exercises of one template. */
export const saveTemplateRequestSchema = z.object({
	baseVersionId: z.uuid(),
	templateId: z.uuid(),
	exercises: z.array(templateExerciseSchema).max(PROGRAM_EXERCISES_PER_TEMPLATE_MAX),
})
export type SaveTemplateRequest = z.infer<typeof saveTemplateRequestSchema>
