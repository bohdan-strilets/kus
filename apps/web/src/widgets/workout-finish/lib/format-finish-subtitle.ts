import type { WorkoutResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatDayHeading, formatTime, toCalendarDate } from '@/shared/lib'

const MS_IN_MINUTE = 60_000

/**
 * «Субота, 31 жовтня · 18:30–19:22»: a finished session knows both ends (its duration is measured
 * or named by the form), so the range is real; without a start only the day.
 */
export const formatFinishSubtitle = (
	workout: Pick<WorkoutResponse, 'localDate' | 'startedAt' | 'durationMin'>,
	t: TFunction,
): string => {
	const date = formatDayHeading(toCalendarDate(workout.localDate))
	if (workout.startedAt === null) return date
	const start = new Date(workout.startedAt)
	const time =
		workout.durationMin === null
			? formatTime(start)
			: t('training.session.timeRange', {
					from: formatTime(start),
					to: formatTime(new Date(start.getTime() + workout.durationMin * MS_IN_MINUTE)),
				})
	return t('training.session.subtitle', { date, time })
}
