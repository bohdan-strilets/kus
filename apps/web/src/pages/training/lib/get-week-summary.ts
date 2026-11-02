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
	/** ISO weekday, 1 = Monday … 7 = Sunday: how a program names its days. */
	isoWeekday: number
	workouts: WorkoutResponse[]
}

export interface WeekSummary {
	/** `YYYY-MM-DD` of the Monday. */
	weekStart: string
	/** `YYYY-MM-DD` of the Sunday. */
	weekEnd: string
	/** Monday to Sunday of the week. */
	days: WeekDay[]
	count: number
	/** Minutes of the week: the named duration, otherwise the estimate. */
	minutes: number
}

/** The minutes of one training: what the user named, otherwise the estimate, otherwise nothing. */
export const getWorkoutMinutes = (
	workout: Pick<WorkoutResponse, 'durationMin' | 'estimatedDurationMin'>,
): number => workout.durationMin ?? workout.estimatedDurationMin ?? 0

/** The Monday of the week that holds `localDate`. */
export const getWeekMonday = (localDate: string): string =>
	shiftLocalDate(localDate, -DAYS_SINCE_MONDAY[getWeekday(localDate)])

/** «Цей тиждень»: the seven days of the week of `date` with their trainings, the count and the time. */
export const getWeekSummary = (workouts: readonly WorkoutResponse[], date: string): WeekSummary => {
	const weekStart = getWeekMonday(date)
	const weekEnd = shiftLocalDate(weekStart, DAYS_IN_WEEK - 1)
	const thisWeek = workouts.filter(
		(workout) => workout.localDate >= weekStart && workout.localDate <= weekEnd,
	)
	return {
		weekStart,
		weekEnd,
		days: Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
			const localDate = shiftLocalDate(weekStart, index)
			const dayWorkouts = thisWeek.filter((workout) => workout.localDate === localDate)
			return {
				localDate,
				hasTraining: dayWorkouts.length > 0,
				isoWeekday: index + 1,
				workouts: dayWorkouts,
			}
		}),
		count: thisWeek.length,
		minutes: thisWeek.reduce((sum, workout) => sum + getWorkoutMinutes(workout), 0),
	}
}
