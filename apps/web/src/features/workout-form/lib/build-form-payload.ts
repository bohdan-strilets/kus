import type { FormExerciseInput, WorkoutForm } from '@kus/shared'

import type { FormExerciseValue, WorkoutFormValues } from './workout-form.types'

const toExerciseInput = (exercise: FormExerciseValue): FormExerciseInput => ({
	exerciseId: exercise.exerciseId,
	templateExerciseId: exercise.templateExerciseId,
	name: exercise.name.trim(),
	kind: exercise.kind,
	muscleGroup: exercise.muscleGroup,
	isBodyweight: exercise.isBodyweight,
	durationMin: exercise.durationMin,
	distanceM: exercise.distanceM,
	sets: exercise.sets.map(({ reps, weightKg, durationSec, distanceM, isWarmup }) => ({
		reps,
		// a bodyweight exercise has no weight on any set (the server rejects it otherwise)
		weightKg: exercise.isBodyweight === true ? null : weightKg,
		durationSec,
		distanceM,
		isWarmup,
	})),
})

/**
 * The body of `POST /workout-forms`. «Не робили» exercises are left out: they are not saved at all.
 * `clientRequestId` is made once per form, so pressing «Зберегти» again repeats the same request.
 */
export const buildFormPayload = ({
	values,
	clientRequestId,
	templateId,
}: {
	values: WorkoutFormValues
	clientRequestId: string
	templateId: string | null
}): WorkoutForm => ({
	clientRequestId,
	templateId,
	localDate: values.localDate,
	startTime: values.startTime,
	// the schema has checked it is there; the fallback keeps the type honest
	durationMin: values.durationMin ?? 1,
	exercises: values.exercises.filter((exercise) => !exercise.isSkipped).map(toExerciseInput),
})
