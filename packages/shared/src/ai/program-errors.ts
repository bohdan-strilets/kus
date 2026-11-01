// What the parser rejects in propose_program. Shared, so the backend and the eval judge the same
// way; the model gets the text on the retry.
import type { ParseRefs } from './entry-edits.js'
import type { ProgramExerciseInput } from './program-tools.js'
import type { ProposeProgramInput } from './tools.js'

const getExerciseErrors = (
	exercise: ProgramExerciseInput,
	path: string,
	refs: ParseRefs,
): string[] => {
	const errors: string[] = []
	if (exercise.exerciseRef !== null && !refs.exerciseRefs?.has(exercise.exerciseRef)) {
		errors.push(
			`propose_program: ${path}.exerciseRef "${exercise.exerciseRef}" is not in "Exercises"`,
		)
	}
	if (
		exercise.repsMin !== null &&
		exercise.repsMax !== null &&
		exercise.repsMin > exercise.repsMax
	) {
		errors.push(`propose_program: ${path} has repsMin above repsMax`)
	}
	return errors
}

export const getProgramErrors = (program: ProposeProgramInput, refs: ParseRefs): string[] => {
	const errors: string[] = []
	const seenRefs = new Set<string>()
	program.templates.forEach((template, index) => {
		const path = `templates.${index}`
		if (template.ref !== null) {
			if (!refs.templateRefs?.has(template.ref)) {
				errors.push(`propose_program: ${path}.ref "${template.ref}" is not in "Program"`)
			} else if (seenRefs.has(template.ref)) {
				errors.push(`propose_program: ${path}.ref "${template.ref}" repeats — one template per ref`)
			}
			seenRefs.add(template.ref)
		}
		if (new Set(template.weekdays).size !== template.weekdays.length) {
			errors.push(`propose_program: ${path}.weekdays repeat a day`)
		}
		template.exercises.forEach((exercise, exerciseIndex) => {
			errors.push(...getExerciseErrors(exercise, `${path}.exercises.${exerciseIndex}`, refs))
		})
	})
	if (program.pinnedRef !== null && !seenRefs.has(program.pinnedRef)) {
		errors.push(`propose_program: pinnedRef "${program.pinnedRef}" is not a ref of these templates`)
	}
	return errors
}
