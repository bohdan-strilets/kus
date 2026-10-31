import type { WorkoutResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatWorkoutDuration, formatWorkoutKind } from '@/entities/workout'

/** How the dialog and the aria-label name the training, as the header of its screen: «Зал, 62 хв» / «Зал, ≈ 62 хв»; no duration — just «Зал». */
export const formatWorkoutName = (workout: WorkoutResponse, t: TFunction): string => {
	const kind = formatWorkoutKind(workout.place, t)
	const duration = formatWorkoutDuration(workout, t)
	return duration === null ? kind : `${kind}, ${duration}`
}
