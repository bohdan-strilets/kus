import type { ProgramProposalContext } from '@kus/shared'

import type { ExpectedProgram, ExpectedProgramTemplate } from './cases/case.types.js'
import type { LoggedProgram, LoggedProgramTemplate } from './eval.types.js'

interface Range {
	min: number
	max: number
}

const isInRange = (range: Range | undefined, value: number): boolean =>
	range === undefined || (value >= range.min && value <= range.max)

const isModeRight = (want: ExpectedProgram['mode'], got: LoggedProgram['mode']): boolean => {
	if (want === undefined) return true
	return Array.isArray(want) ? want.includes(got) : want === got
}

const hasExercise = (template: LoggedProgramTemplate, stem: string): boolean =>
	template.exercises.some((exercise) => exercise.name.toLowerCase().includes(stem))

const isSameWeekdays = (want: readonly number[], got: readonly number[]): boolean =>
	want.length === got.length && want.every((day) => got.includes(day))

const isTemplateRight = (want: ExpectedProgramTemplate, got: LoggedProgramTemplate): boolean =>
	(want.nameIncludes === undefined || got.name.toLowerCase().includes(want.nameIncludes)) &&
	(want.weekdays === undefined || isSameWeekdays(want.weekdays, got.weekdays)) &&
	isInRange(want.exerciseCount, got.exercises.length) &&
	(want.exercises ?? []).every(
		(exercise) => hasExercise(got, exercise.nameIncludes) !== (exercise.absent === true),
	)

/** Takes a match out of the pool: every expected template is found once (extra ones are fine). */
const areTemplatesFound = (
	wants: readonly ExpectedProgramTemplate[],
	gots: readonly LoggedProgramTemplate[],
): boolean => {
	const pool = [...gots]
	return wants.every((want) => {
		const index = pool.findIndex((candidate) => isTemplateRight(want, candidate))
		if (index === -1) return false
		pool.splice(index, 1)
		return true
	})
}

const isPinRight = (
	name: string | undefined,
	got: LoggedProgram,
	context: ProgramProposalContext | null | undefined,
): boolean => {
	if (name === undefined) return true
	const ref = context?.templates.find((template) => template.name === name)?.ref
	return ref !== undefined && got.pinnedRef === ref
}

const isKeepingRefs = (
	got: LoggedProgram,
	context: ProgramProposalContext | null | undefined,
): boolean => {
	const refs = got.templates.flatMap((template) => (template.ref === null ? [] : [template.ref]))
	return (context?.templates ?? []).every((template) => refs.includes(template.ref))
}

/**
 * The proposal matches every expectation given; `context` is the program the change is built on
 * (for refs): the case's open proposal, else its active program.
 * No proposal at all never matches.
 */
export const isProgramCorrect = (
	expected: ExpectedProgram,
	actual: LoggedProgram | null,
	context: ProgramProposalContext | null | undefined,
): boolean => {
	if (actual === null) return false
	return (
		isModeRight(expected.mode, actual.mode) &&
		isInRange(expected.templateCount, actual.templates.length) &&
		areTemplatesFound(expected.templates ?? [], actual.templates) &&
		isPinRight(expected.pinnedRefOf, actual, context) &&
		(expected.noInventedWeights !== true ||
			actual.templates.every((template) =>
				template.exercises.every((exercise) => exercise.weightKg === null),
			)) &&
		(expected.keepsRefs !== true || isKeepingRefs(actual, context)) &&
		actual.templates.every((template) =>
			isInRange(expected.exerciseCount, template.exercises.length),
		)
	)
}
