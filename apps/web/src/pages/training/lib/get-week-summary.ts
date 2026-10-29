import { getWeekday, type Weekday, type WorkoutResponse } from '@kus/shared'

import { shiftLocalDate } from '@/shared/lib'

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

export interface WeekSummary {
	count: number
	/** Minutes of the trainings that said how long they took. */
	minutes: number
}

/** «Цей тиждень»: the trainings from this Monday to today and their total time. */
export const getWeekSummary = (
	workouts: readonly WorkoutResponse[],
	today: string,
): WeekSummary => {
	const weekStart = shiftLocalDate(today, -DAYS_SINCE_MONDAY[getWeekday(today)])
	const thisWeek = workouts.filter(
		(workout) => workout.localDate >= weekStart && workout.localDate <= today,
	)
	return {
		count: thisWeek.length,
		minutes: thisWeek.reduce((sum, workout) => sum + (workout.durationMin ?? 0), 0),
	}
}
