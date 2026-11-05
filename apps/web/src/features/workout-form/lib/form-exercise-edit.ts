import { type ExercisePick, NEW_CARDIO_MIN } from '@/entities/workout'
import { createUuid } from '@/shared/lib'

import type { FormExerciseValue, FormSetValue } from './workout-form.types'

const emptySet = (): FormSetValue => ({
	rowKey: createUuid(),
	planKey: null,
	reps: null,
	weightKg: null,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
})

/** An exercise picked in «+ Вправа»: no plan to return to; its last working sets are the start. */
export const createFormExercise = (pick: ExercisePick, key: string): FormExerciseValue => {
	const base = {
		key,
		exerciseId: pick.exerciseId,
		templateExerciseId: null,
		name: pick.name,
		kind: pick.kind,
		muscleGroup: pick.muscleGroup,
		isBodyweight: null,
		distanceM: null,
		isSkipped: false,
		plan: null,
	}
	if (pick.kind === 'CARDIO') return { ...base, durationMin: NEW_CARDIO_MIN, sets: [] }
	const last = (pick.lastSets ?? []).filter((set) => !set.isWarmup)
	return {
		...base,
		durationMin: null,
		sets:
			last.length > 0
				? last.map(({ reps, weightKg }) => ({ ...emptySet(), reps, weightKg }))
				: [emptySet()],
	}
}

export const patchFormSet = (
	exercise: FormExerciseValue,
	setIndex: number,
	patch: Partial<Pick<FormSetValue, 'reps' | 'weightKg'>>,
): FormExerciseValue => ({
	...exercise,
	sets: exercise.sets.map((set, index) => (index === setIndex ? { ...set, ...patch } : set)),
})

/** «+ Підхід»: a copy of the last working set. */
export const addFormSet = (exercise: FormExerciseValue): FormExerciseValue => {
	const last = [...exercise.sets].reverse().find((set) => !set.isWarmup)
	return {
		...exercise,
		sets: [...exercise.sets, { ...(last ?? emptySet()), rowKey: createUuid(), planKey: null }],
	}
}

/** No weight: the person's own switch, else what the dictionary says. */
export const isFormBodyweight = (exercise: FormExerciseValue): boolean =>
	exercise.isBodyweight ?? exercise.plan?.isBodyweight ?? false

/** The set leaves the exercise; the rows below are numbered again by the table. */
export const removeFormSet = (
	exercise: FormExerciseValue,
	setIndex: number,
): FormExerciseValue => ({
	...exercise,
	sets: exercise.sets.filter((_, index) => index !== setIndex),
})

/** «Скасувати»: the set returns to the same place (kept inside the list if sets went meanwhile). */
export const restoreFormSet = (
	exercise: FormExerciseValue,
	setIndex: number,
	set: FormSetValue,
): FormExerciseValue => {
	const at = Math.min(setIndex, exercise.sets.length)
	return { ...exercise, sets: [...exercise.sets.slice(0, at), set, ...exercise.sets.slice(at)] }
}
