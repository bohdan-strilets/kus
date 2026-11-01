import type {
	ProgramChangeLine,
	ProgramChanges,
	ProgramDraft,
	ProgramTemplateDraft,
	TemplateExerciseDraft,
	TemplateExerciseTarget,
} from '../schemas/programs.js'
import { normalizeExerciseName } from './exercise-name.js'

const TARGET_FIELDS = [
	'sets',
	'repsMin',
	'repsMax',
	'weightKg',
	'progressStepKg',
	'restSec',
	'durationMin',
	'distanceM',
] as const satisfies readonly (keyof TemplateExerciseTarget)[]

const isTargetEqual = (a: TemplateExerciseTarget, b: TemplateExerciseTarget): boolean =>
	TARGET_FIELDS.every((field) => a[field] === b[field])

const isSameList = (a: readonly number[], b: readonly number[]): boolean =>
	a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index])

/**
 * Pairs `next` items with unused `base` items, one pass per matcher; a duplicate takes the first
 * still-unused base item, so equal names pair in order. Returns `next` index → `base` index.
 */
const pairItems = <T>(
	base: readonly T[],
	next: readonly T[],
	matchers: readonly ((a: T, b: T) => boolean)[],
): Map<number, number> => {
	const pairs = new Map<number, number>()
	const usedBase = new Set<number>()
	for (const matches of matchers) {
		next.forEach((item, nextIndex) => {
			if (pairs.has(nextIndex)) return
			const baseIndex = base.findIndex(
				(candidate, index) => !usedBase.has(index) && matches(candidate, item),
			)
			if (baseIndex === -1) return
			pairs.set(nextIndex, baseIndex)
			usedBase.add(baseIndex)
		})
	}
	return pairs
}

const line = (
	partial: Pick<ProgramChangeLine, 'op' | 'scope'> & Partial<ProgramChangeLine>,
): ProgramChangeLine => ({
	templateName: null,
	name: null,
	field: null,
	before: null,
	after: null,
	...partial,
})

const diffProgramFields = (base: ProgramDraft, next: ProgramDraft): ProgramChangeLine[] => {
	const lines: ProgramChangeLine[] = []
	if (base.mode !== next.mode) {
		lines.push(
			line({ op: 'CHANGE', scope: 'PROGRAM', field: 'mode', before: base.mode, after: next.mode }),
		)
	}
	if (base.perWeek !== next.perWeek) {
		lines.push(
			line({
				op: 'CHANGE',
				scope: 'PROGRAM',
				field: 'perWeek',
				before: base.perWeek,
				after: next.perWeek,
			}),
		)
	}
	if (base.title !== next.title) {
		lines.push(
			line({
				op: 'CHANGE',
				scope: 'PROGRAM',
				field: 'title',
				before: base.title,
				after: next.title,
			}),
		)
	}
	return lines
}

const isSameExercise = (a: TemplateExerciseDraft, b: TemplateExerciseDraft): boolean =>
	normalizeExerciseName(a.name) === normalizeExerciseName(b.name)

const diffExercises = (
	base: ProgramTemplateDraft,
	next: ProgramTemplateDraft,
): ProgramChangeLine[] => {
	const templateName = next.name
	const pairs = pairItems(base.exercises, next.exercises, [
		(a, b) => a.exerciseId !== null && a.exerciseId === b.exerciseId,
		isSameExercise,
	])
	const lines: ProgramChangeLine[] = []
	next.exercises.forEach((exercise, nextIndex) => {
		const baseIndex = pairs.get(nextIndex)
		const baseExercise = baseIndex === undefined ? undefined : base.exercises[baseIndex]
		if (!baseExercise) {
			lines.push(line({ op: 'ADD', scope: 'EXERCISE', templateName, name: exercise.name }))
			return
		}
		if (isTargetEqual(baseExercise.target, exercise.target)) return
		lines.push(
			line({
				op: 'CHANGE',
				scope: 'EXERCISE',
				templateName,
				name: exercise.name,
				field: 'target',
				before: baseExercise.target,
				after: exercise.target,
			}),
		)
	})
	const pairedBase = new Set(pairs.values())
	base.exercises.forEach((exercise, index) => {
		if (pairedBase.has(index)) return
		lines.push(
			line({
				op: 'REMOVE',
				scope: 'EXERCISE',
				templateName,
				name: exercise.name,
				before: exercise.target,
			}),
		)
	})
	const baseOrder = next.exercises.flatMap((_, nextIndex) => pairs.get(nextIndex) ?? [])
	if (baseOrder.some((baseIndex, index) => index > 0 && baseIndex < (baseOrder[index - 1] ?? 0))) {
		lines.push(line({ op: 'REORDER', scope: 'TEMPLATE', templateName }))
	}
	return lines
}

const diffTemplate = (
	base: ProgramTemplateDraft,
	next: ProgramTemplateDraft,
): ProgramChangeLine[] => {
	const lines: ProgramChangeLine[] = []
	if (base.name !== next.name) {
		lines.push(
			line({
				op: 'CHANGE',
				scope: 'TEMPLATE',
				templateName: next.name,
				field: 'name',
				before: base.name,
				after: next.name,
			}),
		)
	}
	if (!isSameList(base.weekdays, next.weekdays)) {
		lines.push(
			line({
				op: 'CHANGE',
				scope: 'TEMPLATE',
				templateName: next.name,
				field: 'weekdays',
				before: [...base.weekdays],
				after: [...next.weekdays],
			}),
		)
	}
	return [...lines, ...diffExercises(base, next)]
}

const diffTemplates = (
	base: ProgramDraft,
	next: ProgramDraft,
): { lines: ProgramChangeLine[]; unchanged: number } => {
	const pairs = pairItems(base.templates, next.templates, [
		(a, b) => a.key === b.key,
		(a, b) => normalizeExerciseName(a.name) === normalizeExerciseName(b.name),
	])
	const lines: ProgramChangeLine[] = []
	let unchanged = 0
	next.templates.forEach((template, nextIndex) => {
		const baseIndex = pairs.get(nextIndex)
		const baseTemplate = baseIndex === undefined ? undefined : base.templates[baseIndex]
		if (!baseTemplate) {
			lines.push(
				line({ op: 'ADD', scope: 'TEMPLATE', templateName: template.name, name: template.name }),
			)
			return
		}
		const templateLines = diffTemplate(baseTemplate, template)
		if (templateLines.length === 0) unchanged += 1
		lines.push(...templateLines)
	})
	const pairedBase = new Set(pairs.values())
	base.templates.forEach((template, index) => {
		if (pairedBase.has(index)) return
		lines.push(
			line({ op: 'REMOVE', scope: 'TEMPLATE', templateName: template.name, name: template.name }),
		)
	})
	return { lines, unchanged }
}

/** What `next` changes against `base`; `base` null is the first version of a program. */
export const diffPrograms = (base: ProgramDraft | null, next: ProgramDraft): ProgramChanges => {
	if (!base) return { v: 1, initial: true, lines: [], unchangedTemplates: 0 }
	const templates = diffTemplates(base, next)
	return {
		v: 1,
		initial: false,
		lines: [...diffProgramFields(base, next), ...templates.lines],
		unchangedTemplates: templates.unchanged,
	}
}
