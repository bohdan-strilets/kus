import type { TFunction } from 'i18next'

import { DETAIL_SEPARATOR, formatNumber, formatWorkoutMinutes } from '@/entities/workout'

import { isFormBodyweight } from './form-exercise-edit'
import type { FormExerciseValue } from './workout-form.types'

/**
 * «3 підходи · 120 кг × 12», «3 підходи · 15 повт.», «10 хв»: what the exercise says before
 * anything is edited. The plan's own sets are the source — the row says what «Як за планом»
 * brings back.
 */
export const formatPlanSummary = (exercise: FormExerciseValue, t: TFunction): string | null => {
	if (exercise.kind === 'CARDIO') {
		const minutes = exercise.plan?.durationMin ?? exercise.durationMin
		return minutes === null ? null : formatWorkoutMinutes(minutes, t)
	}
	const sets = (exercise.plan?.sets ?? exercise.sets).filter((set) => !set.isWarmup)
	const first = sets[0]
	if (!first) return null
	const count = t('workout.setCountFull', { count: sets.length })
	if (first.reps === null) return count
	const hasWeight = !isFormBodyweight(exercise) && first.weightKg !== null && first.weightKg > 0
	const load = hasWeight
		? t('workout.setWeightReps', { weight: formatNumber(first.weightKg ?? 0), reps: first.reps })
		: t('workout.reps', { value: first.reps })
	return `${count}${DETAIL_SEPARATOR}${load}`
}
