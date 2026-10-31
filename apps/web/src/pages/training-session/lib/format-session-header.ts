import type { WorkoutResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatWorkoutDuration, formatWorkoutKind } from '@/entities/workout'
import { formatDayHeading, formatTime, toCalendarDate } from '@/shared/lib'

const MS_IN_MINUTE = 60_000

export interface SessionHeader {
	/** «Зал · 62 хв», «Зал · ≈ 62 хв»; without a duration only the place. */
	title: string
	/** «Понеділок, 26 жовтня · 18:30–19:32»; the range only when the duration is known. */
	subtitle: string
}

/**
 * The time under the title: the start, and «18:30–19:32» only for an estimated duration — it is
 * measured from the start to the finish, so the end is real. A named duration («30 хв») says nothing
 * about when it ended, so it stays the start only; no start — no time at all.
 */
export const formatSessionTime = (
	workout: Pick<WorkoutResponse, 'startedAt' | 'durationMin' | 'estimatedDurationMin'>,
	t: TFunction,
): string | null => {
	if (workout.startedAt === null) return null
	const start = new Date(workout.startedAt)
	if (workout.durationMin !== null || workout.estimatedDurationMin === null)
		return formatTime(start)
	return t('training.session.timeRange', {
		from: formatTime(start),
		to: formatTime(new Date(start.getTime() + workout.estimatedDurationMin * MS_IN_MINUTE)),
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
