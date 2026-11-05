import type { TFunction } from 'i18next'

import { DETAIL_SEPARATOR, formatNumber, formatWorkoutMinutes } from '@/entities/workout'

import { isFormBodyweight } from './form-exercise-edit'
import type { FormExerciseValue, FormSetValue } from './workout-form.types'

const formatSetsSummary = (
	exercise: FormExerciseValue,
	sets: readonly FormSetValue[],
	t: TFunction,
): string | null => {
	const working = sets.filter((set) => !set.isWarmup)
	const first = working[0]
	if (!first) return null
	const count = t('workout.setCountFull', { count: working.length })
	if (first.reps === null) return count
	const hasWeight = !isFormBodyweight(exercise) && first.weightKg !== null && first.weightKg > 0
	const load = hasWeight
		? t('workout.setWeightReps', { weight: formatNumber(first.weightKg ?? 0), reps: first.reps })
		: t('workout.reps', { value: first.reps })
	return `${count}${DETAIL_SEPARATOR}${load}`
}

/**
 * «3 підходи · 120 кг × 12», «3 підходи · 15 повт.», «10 хв», «без підходів»: what the exercise
 * holds now, so the subtitle follows deleted and added sets.
 */
export const formatExerciseSummary = (exercise: FormExerciseValue, t: TFunction): string | null => {
	if (exercise.kind === 'CARDIO') {
		return exercise.durationMin === null ? null : formatWorkoutMinutes(exercise.durationMin, t)
	}
	return formatSetsSummary(exercise, exercise.sets, t) ?? t('training.form.noSets')
}

/** The same line for the plan's own sets: the «план: …» part, what «Як за планом» brings back. */
export const formatPlanSummary = (exercise: FormExerciseValue, t: TFunction): string | null => {
	if (exercise.kind === 'CARDIO') {
		const minutes = exercise.plan?.durationMin ?? exercise.durationMin
		return minutes === null ? null : formatWorkoutMinutes(minutes, t)
	}
	return formatSetsSummary(exercise, exercise.plan?.sets ?? exercise.sets, t)
}
