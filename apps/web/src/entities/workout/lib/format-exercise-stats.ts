import type { WorkoutStatsExercise } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatNumber } from './format-workout'

/** «70 кг × 5», or «9 повт.» for a bodyweight exercise; null without a working set. */
export const formatBestSet = (best: WorkoutStatsExercise['best'], t: TFunction): string | null => {
	if (best === null) return null
	if (best.weightKg === null || best.weightKg === 0) return t('workout.reps', { value: best.reps })
	return t('workout.setWeightReps', { weight: formatNumber(best.weightKg), reps: best.reps })
}

/** «+10 кг», «−2 повт.», «без змін»; null when there is nothing to compare. */
export const formatChange = (
	exercise: Pick<WorkoutStatsExercise, 'change' | 'isBodyweight'>,
	t: TFunction,
): string | null => {
	const { change } = exercise
	if (change === null) return null
	if (change === 0) return t('training.stats.delta.noChange')
	const unit = exercise.isBodyweight ? 'reps' : 'kg'
	const direction = change > 0 ? 'Up' : 'Down'
	return t(`training.stats.delta.${unit}${direction}`, { value: formatNumber(Math.abs(change)) })
}
