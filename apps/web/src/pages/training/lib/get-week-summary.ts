import { getWeekday, type Weekday, type WorkoutResponse } from '@kus/shared'

import { shiftLocalDate } from '@/shared/lib'

import { DAYS_IN_WEEK } from './training.constants'

/** Days since Monday: the week of the tab runs Monday to Sunday. */
const DAYS_SINCE_MONDAY: Record<Weekday, number> = {
	Mon: 0,
	Tue: 1,
	Wed: 2,
	Thu: 3,
	Fri: 4,
	Sat: 5,
	Sun: 6,
}

export interface WeekDay {
	localDate: string
	hasTraining: boolean
}

export interface WeekSummary {
	/** Monday to Sunday of the current week. */
	days: WeekDay[]
	count: number
	/** Minutes of the week: the named duration, otherwise the estimate. */
	minutes: number
}

/** The minutes of one training: what the user named, otherwise the estimate, otherwise nothing. */
export const getWorkoutMinutes = (
	workout: Pick<WorkoutResponse, 'durationMin' | 'estimatedDurationMin'>,
): number => workout.durationMin ?? workout.estimatedDurationMin ?? 0

/** «Цей тиждень»: the seven days with a mark where there was a training, their count and time. */
export const getWeekSummary = (
	workouts: readonly WorkoutResponse[],
	today: string,
): WeekSummary => {
	const weekStart = shiftLocalDate(today, -DAYS_SINCE_MONDAY[getWeekday(today)])
	const weekEnd = shiftLocalDate(weekStart, DAYS_IN_WEEK - 1)
	const thisWeek = workouts.filter(
		(workout) => workout.localDate >= weekStart && workout.localDate <= weekEnd,
	)
	const trainedDates = new Set(thisWeek.map((workout) => workout.localDate))
	return {
		days: Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
			const localDate = shiftLocalDate(weekStart, index)
			return { localDate, hasTraining: trainedDates.has(localDate) }
		}),
		count: thisWeek.length,
		minutes: thisWeek.reduce((sum, workout) => sum + getWorkoutMinutes(workout), 0),
	}
}
