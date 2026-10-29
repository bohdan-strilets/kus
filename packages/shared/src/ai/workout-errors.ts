// What the parser rejects in log_workout. Shared, so the backend and the eval judge the same way;
// the model gets the text on the retry.
import { ENTRY_BACKDATE_MAX_DAYS, getDayOffset, shiftDate } from './dates.js'
import type { ParseRefs } from './entry-edits.js'
import type { LogWorkoutInput } from './tools.js'
import { countSets, MAX_SETS_PER_EXERCISE } from './workout-tools.js'

const getWorkoutDateErrors = (date: string | null, today: string): string[] => {
	if (date === null) return []
	const offset = getDayOffset(date, today)
	if (offset >= -ENTRY_BACKDATE_MAX_DAYS && offset <= 0) return []
	return [
		`log_workout: date ${date} is outside ${shiftDate(today, -ENTRY_BACKDATE_MAX_DAYS)}…${today} — do not log; tell the user with reply that only today and the last ${ENTRY_BACKDATE_MAX_DAYS} days can be logged`,
	]
}

const getRefErrors = (workout: LogWorkoutInput, refs: ParseRefs): string[] => {
	const errors: string[] = []
	if (workout.replaceRef !== null && !refs.workouts?.has(workout.replaceRef)) {
		errors.push(`log_workout: replaceRef "${workout.replaceRef}" is not in "Today's workouts"`)
	}
	workout.exercises.forEach((exercise, index) => {
		if (exercise.exerciseRef !== null && !refs.exerciseRefs?.has(exercise.exerciseRef)) {
			errors.push(
				`log_workout: exercises.${index}.exerciseRef "${exercise.exerciseRef}" is not in "Exercises"`,
			)
		}
	})
	return errors
}

const getExerciseErrors = (workout: LogWorkoutInput): string[] =>
	workout.exercises.flatMap((exercise, index) => {
		const errors: string[] = []
		if (countSets(exercise) > MAX_SETS_PER_EXERCISE) {
			errors.push(`log_workout: exercises.${index} has more than ${MAX_SETS_PER_EXERCISE} sets`)
		}
		const isEmpty =
			exercise.sets.length === 0 && exercise.durationMin === null && exercise.distanceKm === null
		if (exercise.kind === 'CARDIO' && isEmpty) {
			errors.push(`log_workout: exercises.${index} is cardio with neither minutes nor distance`)
		}
		return errors
	})

/** Two workouts of one message must not replace the same session. */
const getReplaceOverlapErrors = (workouts: readonly LogWorkoutInput[]): string[] => {
	const refs = workouts.flatMap((workout) =>
		workout.replaceRef === null ? [] : [workout.replaceRef],
	)
	return [...new Set(refs.filter((ref, index) => refs.indexOf(ref) !== index))].map(
		(ref) => `log_workout: ${ref} is replaced more than once — one call per workout`,
	)
}

/** A workout that the same message deletes cannot also be replaced: it would be rewritten and removed. */
const getReplaceDeleteErrors = (
	workouts: readonly LogWorkoutInput[],
	deletions: readonly string[],
): string[] =>
	workouts.flatMap((workout) =>
		workout.replaceRef !== null && deletions.includes(workout.replaceRef)
			? [
					`log_workout: ${workout.replaceRef} is also deleted in this message — replace it or delete it, not both`,
				]
			: [],
	)

export const getWorkoutErrors = (
	workouts: readonly LogWorkoutInput[],
	refs: ParseRefs,
	deletions: readonly string[] = [],
): string[] => [
	...getReplaceDeleteErrors(workouts, deletions),
	...workouts.flatMap((workout) => [
		...getWorkoutDateErrors(workout.date, refs.today),
		...getRefErrors(workout, refs),
		...getExerciseErrors(workout),
	]),
	...getReplaceOverlapErrors(workouts),
]
