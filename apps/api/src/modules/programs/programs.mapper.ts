import { randomUUID } from 'node:crypto'

import {
	DEFAULT_PROGRESS_STEP_KG,
	DEFAULT_REST_SEC,
	estimateTemplateMinutes,
	getProgressHintKg,
	isBodyweightByName,
	type LivePlanExercise,
	matchMuscleGroup,
	type MuscleGroup,
	type NextTemplate,
	type ProgramChanges,
	programChangesSchema,
	type ProgramDraft,
	type ProgramExerciseResponse,
	type ProgramResponse,
	type ProgramTemplateDraft,
	type ProgramTemplateResponse,
	type ProgramVersionItem,
	type TemplateExerciseDraft,
	type TemplateExerciseTarget,
} from '@kus/shared'

import type { ExerciseRow as DictionaryRow, LastExerciseResult } from '../workouts/workouts.service'
import type { ActiveProgram, TemplateWrite } from './programs.repository'

type VersionRow = NonNullable<ActiveProgram['activeVersion']>
type TemplateRow = VersionRow['templates'][number]
type ExerciseRow = TemplateRow['exercises'][number]

const toNumber = (value: { toNumber: () => number } | null): number | null =>
	value === null ? null : value.toNumber()

const toTarget = (row: ExerciseRow): TemplateExerciseTarget => ({
	sets: row.sets,
	repsMin: row.repsMin,
	repsMax: row.repsMax,
	weightKg: toNumber(row.weightKg),
	progressStepKg: toNumber(row.progressStepKg),
	restSec: row.restSec,
	durationMin: row.durationMin,
	distanceM: row.distanceM,
})

/** The dictionary's group, then the snapshot of the template; cardio has none. */
const getMuscleGroup = (row: ExerciseRow): MuscleGroup | null =>
	row.kind === 'CARDIO' ? null : (row.exercise?.muscleGroup ?? row.muscleGroup)

const toDraftExercise = (row: ExerciseRow): TemplateExerciseDraft => ({
	name: row.name,
	exerciseId: row.exerciseId,
	kind: row.kind,
	muscleGroup: getMuscleGroup(row),
	target: toTarget(row),
})

const toDraftTemplate = (row: TemplateRow): ProgramTemplateDraft => {
	const exercises = row.exercises.map(toDraftExercise)
	return {
		key: row.key,
		name: row.name,
		weekdays: row.weekdays,
		exercises,
		estimatedMin: estimateTemplateMinutes(exercises),
	}
}

/** The program as the draft the diff compares against; null while it has no active version. */
export const toProgramDraft = (program: ActiveProgram): ProgramDraft | null => {
	if (!program.activeVersion) return null
	const { templates } = program.activeVersion
	return {
		title: program.title,
		mode: program.mode,
		perWeek: program.perWeek,
		templates: templates.map(toDraftTemplate),
		pinnedKey: templates.find(({ id }) => id === program.pinnedTemplateId)?.key ?? null,
	}
}

/**
 * Fills what a target leaves open: a barbell exercise steps by 2.5 kg and rests 90 s, a bodyweight
 * one has no step, cardio has neither.
 */
export const withTargetDefaults = (exercise: TemplateExerciseDraft): TemplateExerciseDraft => {
	const { target, kind } = exercise
	if (kind === 'CARDIO')
		return { ...exercise, target: { ...target, progressStepKg: null, restSec: null } }
	if (kind !== 'STRENGTH') return exercise
	const progressStepKg =
		target.weightKg === null ? null : (target.progressStepKg ?? DEFAULT_PROGRESS_STEP_KG)
	return {
		...exercise,
		target: { ...target, progressStepKg, restSec: target.restSec ?? DEFAULT_REST_SEC },
	}
}

/** Defaults, a fresh key for a repeated one, weekdays sorted, and the estimate counted here. */
export const normalizeDraft = (draft: ProgramDraft): ProgramDraft => {
	const seenKeys = new Set<string>()
	return {
		...draft,
		templates: draft.templates.map((template) => {
			const key = seenKeys.has(template.key) ? randomUUID() : template.key
			seenKeys.add(key)
			const exercises = template.exercises.map(withTargetDefaults)
			return {
				...template,
				key,
				weekdays: [...template.weekdays].sort((a, b) => a - b),
				exercises,
				estimatedMin: estimateTemplateMinutes(exercises),
			}
		}),
	}
}

/** The rows of a template; `rows` are the dictionary rows resolved for its exercises, in order. */
export const toTemplateWrite = (
	template: ProgramTemplateDraft,
	position: number,
	rows: readonly DictionaryRow[],
): TemplateWrite => ({
	key: template.key,
	name: template.name,
	position,
	weekdays: template.weekdays,
	exercises: template.exercises.map(({ name, kind, muscleGroup, target }, index) => {
		const row = rows[index]
		return {
			exerciseId: row?.id ?? null,
			name,
			kind,
			// the draft's group, else the dictionary's, else the dictionary of names; cardio has none
			muscleGroup:
				kind === 'CARDIO' ? null : (muscleGroup ?? row?.muscleGroup ?? matchMuscleGroup(name)),
			position: index,
			...target,
		}
	}),
})

/** The template's flag, then the dictionary's, then the name; cardio has none. */
const getIsBodyweight = (row: ExerciseRow): boolean | null => {
	if (row.kind !== 'STRENGTH') return row.isBodyweight
	return row.isBodyweight ?? row.exercise?.isBodyweight ?? isBodyweightByName(row.name)
}

const toExerciseResponse = (
	row: ExerciseRow,
	lastSets: ReadonlyMap<string, LastExerciseResult>,
): ProgramExerciseResponse => {
	const last = row.exerciseId === null ? undefined : lastSets.get(row.exerciseId)
	const target = toTarget(row)
	const isBodyweight = getIsBodyweight(row)
	return {
		id: row.id,
		exerciseId: row.exerciseId,
		name: row.name,
		kind: row.kind,
		muscleGroup: getMuscleGroup(row),
		position: row.position,
		target,
		lastSets: last?.sets ?? null,
		lastPerformedAt: last?.performedAt.toISOString() ?? null,
		isBodyweight,
		progressHintKg:
			row.kind === 'STRENGTH'
				? getProgressHintKg({
						lastSets: last?.sets ?? null,
						repsMax: target.repsMax,
						weightKg: target.weightKg,
						progressStepKg: target.progressStepKg,
						isBodyweight,
					})
				: null,
	}
}

/** One exercise of the template a live session follows: its target, the last time and the hint. */
export const toLivePlanExercise = (
	row: ExerciseRow,
	lastSets: ReadonlyMap<string, LastExerciseResult>,
): LivePlanExercise => {
	const { id, exerciseId, name, kind, muscleGroup, isBodyweight, target, ...last } =
		toExerciseResponse(row, lastSets)
	return {
		templateExerciseId: id,
		exerciseId,
		name,
		kind,
		muscleGroup,
		isBodyweight,
		...target,
		lastSets: last.lastSets,
		progressHintKg: last.progressHintKg,
	}
}

const toTemplateResponse = (
	row: TemplateRow,
	lastSets: ReadonlyMap<string, LastExerciseResult>,
): ProgramTemplateResponse => {
	const exercises = row.exercises.map((exercise) => toExerciseResponse(exercise, lastSets))
	const muscleGroups = exercises.flatMap(({ muscleGroup }) => muscleGroup ?? [])
	return {
		id: row.id,
		key: row.key,
		name: row.name,
		position: row.position,
		weekdays: row.weekdays,
		estimatedMin: estimateTemplateMinutes(row.exercises.map(toDraftExercise)),
		muscleGroups: [...new Set(muscleGroups)],
		hasCardio: exercises.some(({ kind }) => kind === 'CARDIO'),
		exercises,
	}
}

export const toProgramResponse = ({
	program,
	lastSets,
	next,
}: {
	program: ActiveProgram & { activeVersion: VersionRow }
	lastSets: ReadonlyMap<string, LastExerciseResult>
	next: NextTemplate | null
}): ProgramResponse => {
	const { activeVersion } = program
	const nextTemplate = next && activeVersion.templates.find(({ key }) => key === next.key)
	return {
		id: program.id,
		title: program.title,
		mode: program.mode,
		perWeek: program.perWeek,
		pinnedTemplateId: program.pinnedTemplateId,
		version: { id: activeVersion.id, createdAt: activeVersion.createdAt.toISOString() },
		templates: activeVersion.templates.map((template) => toTemplateResponse(template, lastSets)),
		next:
			next && nextTemplate
				? {
						templateId: nextTemplate.id,
						weekday: next.weekday,
						date: next.date,
						isToday: next.isToday,
					}
				: null,
	}
}

export const readChanges = (value: unknown): ProgramChanges => programChangesSchema.parse(value)

export const toVersionItem = (
	version: { id: string; createdAt: Date; changes: unknown },
	activeVersionId: string | null,
): ProgramVersionItem => ({
	id: version.id,
	createdAt: version.createdAt.toISOString(),
	isCurrent: version.id === activeVersionId,
	changes: readChanges(version.changes),
})
