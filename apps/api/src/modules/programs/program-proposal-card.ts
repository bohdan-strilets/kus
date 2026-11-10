import { randomUUID } from 'node:crypto'

import {
	diffPrograms,
	matchMuscleGroup,
	type MuscleGroup,
	normalizeExerciseName,
	type ProgramCard,
	type ProgramDraft,
	type ProgramExerciseInput,
	type ProgramTemplateDraft,
	type ProposeProgramInput,
	type TemplateExerciseDraft,
} from '@kus/shared'

import { canBeSameExercise } from '../workouts/exercise-names'
import { toDistanceM } from '../workouts/workout-turn'
import type { ExerciseRow } from '../workouts/workouts.service'
import { normalizeDraft } from './programs.mapper'

/** What the refs of one model turn stand for: t-ref → template key, x-ref → dictionary id. */
export interface ProposalRefs {
	/** The active program's t-refs and the open proposal's (built on the same version). */
	templateKeys: ReadonlyMap<string, string>
	exerciseIds: ReadonlyMap<string, string>
}

/** A dictionary row by id, for the rows an x-ref points at. */
export type RefRows = ReadonlyMap<string, ExerciseRow>

export interface ProposalSources {
	/** The active program as a draft; null without one. */
	base: ProgramDraft | null
	baseVersionId: string | null
	refs: ProposalRefs
	/** The dictionary row of each exercise, by template and exercise index; null where none. */
	rows: readonly (readonly (ExerciseRow | null)[])[]
	/** The rows the x-refs point at; a ref whose row is missing here (deleted) is kept as it is. */
	refRows?: RefRows
}

/** Same priority as a logged workout: the row's group, the dictionary of names, then the model's. */
const getMuscleGroup = (
	input: ProgramExerciseInput,
	row: ExerciseRow | null,
): MuscleGroup | null => {
	if (input.kind === 'CARDIO') return null
	return (
		row?.muscleGroup ??
		(row ? matchMuscleGroup(row.name) : null) ??
		matchMuscleGroup(input.name) ??
		input.muscleGroup
	)
}

const findBaseExercise = (
	baseTemplate: ProgramTemplateDraft | undefined,
	exerciseId: string | null,
	name: string,
): TemplateExerciseDraft | undefined =>
	baseTemplate?.exercises.find(
		(exercise) =>
			(exerciseId !== null && exercise.exerciseId === exerciseId) ||
			normalizeExerciseName(exercise.name) === normalizeExerciseName(name),
	)

/** The id behind the x-ref, unless the ref's exercise is not the one the name says (the name decides; the same check as on accept). */
const getRefExerciseId = (
	input: ProgramExerciseInput,
	{ refs, refRows }: { refs: ProposalRefs; refRows: RefRows },
): string | undefined => {
	const id = input.exerciseRef === null ? undefined : refs.exerciseIds.get(input.exerciseRef)
	if (id === undefined) return undefined
	const refRow = refRows.get(id)
	return refRow && !canBeSameExercise(input, refRow) ? undefined : id
}

/**
 * The model never sees the step and the rest: an exercise already in the template keeps them (the
 * model's rest wins when it names one); normalizeDraft fills the defaults for the rest.
 */
const toDraftExercise = (
	input: ProgramExerciseInput,
	{
		row,
		refs,
		refRows,
		baseTemplate,
	}: {
		row: ExerciseRow | null
		refs: ProposalRefs
		refRows: RefRows
		baseTemplate: ProgramTemplateDraft | undefined
	},
): TemplateExerciseDraft => {
	const exerciseId = getRefExerciseId(input, { refs, refRows }) ?? row?.id ?? null
	const kept = findBaseExercise(baseTemplate, exerciseId, input.name)?.target
	return {
		name: input.name,
		exerciseId,
		kind: input.kind,
		muscleGroup: getMuscleGroup(input, row),
		target: {
			sets: input.sets,
			repsMin: input.repsMin,
			repsMax: input.repsMax,
			weightKg: input.weightKg,
			progressStepKg: kept?.progressStepKg ?? null,
			restSec: input.restSec ?? kept?.restSec ?? null,
			durationMin: input.durationMin,
			distanceM: toDistanceM(input.distanceKm),
		},
	}
}

/**
 * A t-ref of the turn keeps its template's key: the diff pairs an active template by it, and a
 * template of the open proposal keeps its own across proposals. Anything else is a new template.
 */
const getTemplateKey = (ref: string | null, { refs }: ProposalSources): string =>
	(ref === null ? undefined : refs.templateKeys.get(ref)) ?? randomUUID()

/** The pin named by the model, else the program's own while its template stays. */
const getPinnedKey = (
	input: ProposeProgramInput,
	templates: readonly { ref: string | null; key: string }[],
	base: ProgramDraft | null,
): string | null => {
	const named = templates.find(({ ref }) => ref !== null && ref === input.pinnedRef)
	if (named) return named.key
	const kept = base?.pinnedKey ?? null
	return templates.some(({ key }) => key === kept) ? kept : null
}

/** The proposal as a draft with keys, ids, groups, defaults and estimates. */
export const toProposalDraft = (
	input: ProposeProgramInput,
	sources: ProposalSources,
): ProgramDraft => {
	const keyed = input.templates.map((template) => ({
		ref: template.ref,
		key: getTemplateKey(template.ref, sources),
	}))
	const templates: ProgramTemplateDraft[] = input.templates.map((template, index) => {
		const key = keyed[index]?.key ?? randomUUID()
		const baseTemplate = sources.base?.templates.find((candidate) => candidate.key === key)
		const rows = sources.rows[index] ?? []
		return {
			key,
			name: template.name,
			weekdays: template.weekdays,
			exercises: template.exercises.map((exercise, exerciseIndex) =>
				toDraftExercise(exercise, {
					row: rows[exerciseIndex] ?? null,
					refs: sources.refs,
					refRows: sources.refRows ?? new Map(),
					baseTemplate,
				}),
			),
			estimatedMin: 0,
		}
	})
	return normalizeDraft({
		title: input.title,
		mode: input.mode,
		perWeek: input.perWeek,
		templates,
		pinnedKey: getPinnedKey(input, keyed, sources.base),
	})
}

/**
 * The card of a draft against the active program; null when the program already is exactly that
 * (nothing in the diff and the same pin).
 */
export const toProposalCard = (
	draft: ProgramDraft,
	{ base, baseVersionId }: Pick<ProposalSources, 'base' | 'baseVersionId'>,
): ProgramCard | null => {
	const changes = diffPrograms(base, draft)
	if (base !== null && changes.lines.length === 0 && base.pinnedKey === draft.pinnedKey) return null
	return { v: 1, baseVersionId, program: draft, changes }
}
