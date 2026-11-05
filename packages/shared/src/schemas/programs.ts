import { z } from 'zod'

import { exerciseKindSchema, muscleGroupSchema, programModeSchema } from './enums.js'

export const DEFAULT_PROGRESS_STEP_KG = 2.5
export const DEFAULT_REST_SEC = 90
export const PROGRESS_STEP_OPTIONS_KG = [1, 2.5, 5] as const
// the editor offers only these chips, so any other step came from somewhere else
const PROGRESS_STEP_STEPS: ReadonlySet<number> = new Set(PROGRESS_STEP_OPTIONS_KG)

export const PROGRAM_SETS_MIN = 1
export const PROGRAM_SETS_MAX = 10
export const PROGRAM_REPS_MIN = 1
export const PROGRAM_REPS_MAX = 100
export const PROGRAM_WEIGHT_KG_MAX = 500
export const PROGRAM_REST_SEC_MIN = 15
export const PROGRAM_REST_SEC_MAX = 600
export const PROGRAM_DURATION_MIN_MAX = 600
export const PROGRAM_DISTANCE_M_MAX = 200_000
export const PROGRAM_TEMPLATES_MAX = 7
export const PROGRAM_EXERCISES_PER_TEMPLATE_MAX = 15
export const PROGRAM_PER_WEEK_MAX = 7
export const PROGRAM_TITLE_MAX_LENGTH = 60
export const PROGRAM_NAME_MAX_LENGTH = 80
export const WEEKDAY_ISO_MIN = 1
export const WEEKDAY_ISO_MAX = 7

const optionalInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable()

export const weekdaysSchema = z
	.array(z.number().int().min(WEEKDAY_ISO_MIN).max(WEEKDAY_ISO_MAX))
	.max(WEEKDAY_ISO_MAX)
	.refine((days) => new Set(days).size === days.length, 'DUPLICATE_WEEKDAYS')

export const templateExerciseTargetSchema = z
	.object({
		sets: optionalInt(PROGRAM_SETS_MIN, PROGRAM_SETS_MAX),
		repsMin: optionalInt(PROGRAM_REPS_MIN, PROGRAM_REPS_MAX),
		repsMax: optionalInt(PROGRAM_REPS_MIN, PROGRAM_REPS_MAX),
		weightKg: z.number().min(0).max(PROGRAM_WEIGHT_KG_MAX).nullable(),
		progressStepKg: z
			.number()
			.refine((step) => PROGRESS_STEP_STEPS.has(step), 'PROGRESS_STEP_INVALID')
			.nullable(),
		restSec: optionalInt(PROGRAM_REST_SEC_MIN, PROGRAM_REST_SEC_MAX),
		durationMin: optionalInt(1, PROGRAM_DURATION_MIN_MAX),
		distanceM: optionalInt(1, PROGRAM_DISTANCE_M_MAX),
	})
	.refine(({ repsMin, repsMax }) => repsMin === null || repsMax === null || repsMin <= repsMax, {
		path: ['repsMax'],
		message: 'REPS_RANGE_INVALID',
	})
export type TemplateExerciseTarget = z.infer<typeof templateExerciseTargetSchema>

export const templateExerciseSchema = z.object({
	name: z.string().trim().min(1).max(PROGRAM_NAME_MAX_LENGTH),
	exerciseId: z.uuid().nullable(),
	kind: exerciseKindSchema,
	muscleGroup: muscleGroupSchema.nullable(),
	/** Optional: an older client does not send it; null/absent = unknown. */
	isBodyweight: z.boolean().nullable().optional(),
	target: templateExerciseTargetSchema,
})
export type TemplateExerciseDraft = z.infer<typeof templateExerciseSchema>

export const programTemplateSchema = z.object({
	key: z.uuid(),
	name: z.string().trim().min(1).max(PROGRAM_NAME_MAX_LENGTH),
	weekdays: weekdaysSchema,
	exercises: z.array(templateExerciseSchema).max(PROGRAM_EXERCISES_PER_TEMPLATE_MAX),
	estimatedMin: z.number().int().min(0),
})
export type ProgramTemplateDraft = z.infer<typeof programTemplateSchema>

export const programDraftSchema = z.object({
	title: z.string().trim().min(1).max(PROGRAM_TITLE_MAX_LENGTH).nullable(),
	mode: programModeSchema,
	perWeek: optionalInt(1, PROGRAM_PER_WEEK_MAX),
	templates: z.array(programTemplateSchema).min(1).max(PROGRAM_TEMPLATES_MAX),
	/** The key of the template mode SINGLE always offers; not part of the diff. */
	pinnedKey: z.uuid().nullable().default(null),
})
export type ProgramDraft = z.infer<typeof programDraftSchema>

export const programChangeOpSchema = z.enum(['ADD', 'REMOVE', 'CHANGE', 'REORDER'])
export type ProgramChangeOp = z.infer<typeof programChangeOpSchema>

export const programChangeScopeSchema = z.enum(['PROGRAM', 'TEMPLATE', 'EXERCISE'])
export type ProgramChangeScope = z.infer<typeof programChangeScopeSchema>

export const programChangeFieldSchema = z.enum([
	'mode',
	'perWeek',
	'title',
	'name',
	'weekdays',
	'target',
])
export type ProgramChangeField = z.infer<typeof programChangeFieldSchema>

const programChangeValueSchema = z.union([
	templateExerciseTargetSchema,
	z.string(),
	z.number(),
	z.array(z.number()),
	z.null(),
])
export type ProgramChangeValue = z.infer<typeof programChangeValueSchema>

export const programChangeLineSchema = z.object({
	op: programChangeOpSchema,
	scope: programChangeScopeSchema,
	templateName: z.string().nullable(),
	name: z.string().nullable(),
	field: programChangeFieldSchema.nullable(),
	before: programChangeValueSchema,
	after: programChangeValueSchema,
})
export type ProgramChangeLine = z.infer<typeof programChangeLineSchema>

export const programChangesSchema = z.object({
	v: z.literal(1),
	initial: z.boolean(),
	lines: z.array(programChangeLineSchema),
	unchangedTemplates: z.number().int().min(0),
})
export type ProgramChanges = z.infer<typeof programChangesSchema>

export const programCardSchema = z.object({
	v: z.literal(1),
	baseVersionId: z.uuid().nullable(),
	program: programDraftSchema,
	changes: programChangesSchema,
})
export type ProgramCard = z.infer<typeof programCardSchema>

/** The active program on request («покажи програму»): a snapshot of the version, never refreshed. */
export const programViewSchema = z.object({
	v: z.literal(1),
	versionId: z.uuid(),
	versionCreatedAt: z.iso.datetime(),
	program: programDraftSchema,
	/** The key of the template that comes next; null when there is none. */
	nextTemplateKey: z.uuid().nullable(),
})
export type ProgramView = z.infer<typeof programViewSchema>

/**
 * Derived when the chat is read, never stored: ACCEPTED — a version came from this card; REPLACED —
 * a newer card exists; OUTDATED — the program moved on (or was removed) since the card was made.
 */
export const programCardStatusSchema = z.enum(['OPEN', 'ACCEPTED', 'REPLACED', 'OUTDATED'])
export type ProgramCardStatus = z.infer<typeof programCardStatusSchema>

export const programCardStateSchema = z.object({
	status: programCardStatusSchema,
	/** ACCEPTED only: when the version was made («✓ Прийнято · версія від 31.10»). */
	versionCreatedAt: z.iso.datetime().nullable(),
})
export type ProgramCardState = z.infer<typeof programCardStateSchema>
