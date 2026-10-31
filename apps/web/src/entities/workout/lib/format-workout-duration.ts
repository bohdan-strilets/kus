import type { WorkoutResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatWorkoutMinutes } from './format-workout'

/**
 * «62 хв» for a duration the user named, «≈ 62 хв» for an estimate («приблизно 62 хв» for a screen
 * reader with `isSpoken`), null for neither.
 */
export const formatWorkoutDuration = (
	workout: Pick<WorkoutResponse, 'durationMin' | 'estimatedDurationMin'>,
	t: TFunction,
	isSpoken = false,
): string | null => {
	if (workout.durationMin !== null) return formatWorkoutMinutes(workout.durationMin, t)
	if (workout.estimatedDurationMin === null) return null
	return t(isSpoken ? 'workout.estimatedSpoken' : 'workout.estimated', {
		duration: formatWorkoutMinutes(workout.estimatedDurationMin, t),
	})
}
