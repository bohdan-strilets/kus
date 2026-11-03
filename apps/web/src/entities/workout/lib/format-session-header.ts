import type { WorkoutResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatWorkoutDuration } from './format-workout-duration'
import { formatWorkoutKind } from './format-workout'
import { formatDayHeading, formatTime, toCalendarDate } from '@/shared/lib'

const MS_IN_MINUTE = 60_000

export interface SessionHeader {
	/** «Зал · 62 хв», «Зал · ≈ 62 хв»; without a duration only the place. */
	title: string
	/** «Понеділок, 26 жовтня · 18:30–19:32»; the range only when the duration is known. */
	subtitle: string
}

/**
 * The time under the title: «18:30–19:32» when the duration is known (measured, named in the form
 * or estimated — the same range the finish screen shows), the start alone when it is not; no
 * start — no time at all.
 */
export const formatSessionTime = (
	workout: Pick<WorkoutResponse, 'startedAt' | 'durationMin' | 'estimatedDurationMin'>,
	t: TFunction,
): string | null => {
	if (workout.startedAt === null) return null
	const start = new Date(workout.startedAt)
	const minutes = workout.durationMin ?? workout.estimatedDurationMin
	if (minutes === null) return formatTime(start)
	return t('training.session.timeRange', {
		from: formatTime(start),
		to: formatTime(new Date(start.getTime() + minutes * MS_IN_MINUTE)),
	})
}

export const formatSessionHeader = (workout: WorkoutResponse, t: TFunction): SessionHeader => {
	const kind = formatWorkoutKind(workout.place, t)
	const duration = formatWorkoutDuration(workout, t)
	const time = formatSessionTime(workout, t)
	const date = formatDayHeading(toCalendarDate(workout.localDate))
	return {
		title: duration === null ? kind : t('training.session.title', { kind, duration }),
		subtitle: time === null ? date : t('training.session.subtitle', { date, time }),
	}
}
