import type { TFunction } from 'i18next'
import type { WorkoutResponse } from '@kus/shared'

import { formatWorkoutKind } from '@/entities/workout'
import { formatTime } from '@/shared/lib'

/** «Зал, 18:30» — the training as the dialog and the aria-label name it; no time — just «Зал». */
export const formatWorkoutName = (workout: WorkoutResponse, t: TFunction): string => {
	const kind = formatWorkoutKind(workout.place, t)
	return workout.startedAt === null ? kind : `${kind}, ${formatTime(new Date(workout.startedAt))}`
}
