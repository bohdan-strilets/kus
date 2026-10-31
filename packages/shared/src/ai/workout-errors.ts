// What the parser rejects in log_workout. Shared, so the backend and the eval judge the same way;
// the model gets the text on the retry.
import { muscleGroupSchema } from '../schemas/enums.js'
import { ENTRY_BACKDATE_MAX_DAYS, getDayOffset, shiftDate } from './dates.js'
import type { ParseRefs } from './entry-edits.js'
import type { LogWorkoutInput } from './tools.js'
import { countSets, MAX_SETS_PER_EXERCISE } from './workout-tools.js'

/** `x1:LEGS` → the ref and the group. */
const GROUP_FIX_SEPARATOR = ':'

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
	if (workout.appendRef !== null && !refs.workouts?.has(workout.appendRef)) {
		errors.push(`log_workout: appendRef "${workout.appendRef}" is not in "Today's workouts"`)
	}
	workout.exercises.forEach((exercise, index) => {
		if (exercise.exerciseRef !== null && !refs.exerciseRefs?.has(exercise.exerciseRef)) {
			errors.push(
				`log_workout: exercises.${index}.exerciseRef "${exercise.exerciseRef}" is not in "Exercises"`,
			)
		}
	})
	for (const fix of workout.exerciseGroups) {
		const [ref = '', group = ''] = fix.split(GROUP_FIX_SEPARATOR)
		if (!refs.exerciseRefs?.has(ref)) {
			errors.push(`log_workout: exerciseGroups "${fix}" — ${ref} is not in "Exercises"`)
		}
		if (!muscleGroupSchema.safeParse(group).success) {
			errors.push(
				`log_workout: exerciseGroups "${fix}" — ${group} is not one of ${muscleGroupSchema.options.join(', ')}`,
			)
		}
	}
	return errors
}

/** A call adds to a session or rewrites it, never both; an empty one only finishes or fixes groups. */
const getModeErrors = (workout: LogWorkoutInput): string[] => {
	const errors: string[] = []
	if (workout.appendRef !== null && workout.replaceRef !== null) {
		errors.push('log_workout: appendRef and replaceRef together — use one')
	}
	if (workout.appendRef !== null && workout.date !== null) {
		errors.push('log_workout: appendRef goes with date null — another day is a new workout')
	}
	const isFinishing = workout.appendRef !== null && workout.finish
	if (workout.exercises.length === 0 && !isFinishing && workout.exerciseGroups.length === 0) {
		errors.push(
			'log_workout: no exercises — allowed only with appendRef and finish, or with exerciseGroups',
		)
	}
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

const findRepeated = (refs: readonly string[]): string[] => [
	...new Set(refs.filter((ref, index) => refs.indexOf(ref) !== index)),
]

/** Two workouts of one message must not replace or add to the same session. */
const getOverlapErrors = (workouts: readonly LogWorkoutInput[]): string[] => {
	const replaced = workouts.flatMap((workout) =>
		workout.replaceRef === null ? [] : [workout.replaceRef],
	)
	const targeted = workouts.flatMap((workout) =>
		[workout.replaceRef, workout.appendRef].filter((ref) => ref !== null),
	)
	const repeatedReplaces = findRepeated(replaced)
	return [
		...repeatedReplaces.map(
			(ref) => `log_workout: ${ref} is replaced more than once — one call per workout`,
		),
		...findRepeated(targeted)
			.filter((ref) => !repeatedReplaces.includes(ref))
			.map((ref) => `log_workout: ${ref} gets more than one call — one call per workout`),
	]
}

/** A workout that the same message deletes cannot also be changed: it would be rewritten and removed. */
const getDeleteErrors = (
	workouts: readonly LogWorkoutInput[],
	deletions: readonly string[],
): string[] =>
	workouts.flatMap((workout) => [
		...(workout.replaceRef !== null && deletions.includes(workout.replaceRef)
			? [
					`log_workout: ${workout.replaceRef} is also deleted in this message — replace it or delete it, not both`,
				]
			: []),
		...(workout.appendRef !== null && deletions.includes(workout.appendRef)
			? [
					`log_workout: ${workout.appendRef} is also deleted in this message — add to it or delete it, not both`,
				]
			: []),
	])

export const getWorkoutErrors = (
	workouts: readonly LogWorkoutInput[],
	refs: ParseRefs,
	deletions: readonly string[] = [],
): string[] => [
	...getDeleteErrors(workouts, deletions),
	...workouts.flatMap((workout) => [
		...getModeErrors(workout),
		...getWorkoutDateErrors(workout.date, refs.today),
		...getRefErrors(workout, refs),
		...getExerciseErrors(workout),
	]),
	...getOverlapErrors(workouts),
]
