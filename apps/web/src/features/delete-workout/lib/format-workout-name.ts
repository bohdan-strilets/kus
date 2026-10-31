import type { WorkoutResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatWorkoutDuration, formatWorkoutKind } from '@/entities/workout'
import { formatTime } from '@/shared/lib'

/**
 * How the dialog and the aria-label name the training. Card (chat): «Зал, 18:30» — no start, just
 * «Зал». Screen: as its header, «Зал, 62 хв» / «Зал, ≈ 62 хв» — no duration, just «Зал».
 */
export const formatWorkoutName = (
	workout: WorkoutResponse,
	t: TFunction,
	{ placement = 'card' }: { placement?: 'card' | 'screen' } = {},
): string => {
	const kind = formatWorkoutKind(workout.place, t)
	if (placement === 'screen') {
		const duration = formatWorkoutDuration(workout, t)
		return duration === null ? kind : `${kind}, ${duration}`
	}
	return workout.startedAt === null ? kind : `${kind}, ${formatTime(new Date(workout.startedAt))}`
}
