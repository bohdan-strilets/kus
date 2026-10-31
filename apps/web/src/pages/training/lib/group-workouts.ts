import type { WorkoutResponse } from '@kus/shared'

export interface WorkoutDayGroup {
	localDate: string
	workouts: WorkoutResponse[]
}

export interface WorkoutMonthGroup {
	/** `YYYY-MM`. */
	monthKey: string
	days: WorkoutDayGroup[]
}

const MONTH_KEY_LENGTH = 7

const byStart = (a: WorkoutResponse, b: WorkoutResponse): number =>
	(a.startedAt ?? '').localeCompare(b.startedAt ?? '')

/** Days newest first (the tab reads like a feed), the trainings inside a day in the order they happened. */
export const groupWorkoutsByDay = (workouts: readonly WorkoutResponse[]): WorkoutDayGroup[] => {
	const byDate = new Map<string, WorkoutResponse[]>()
	for (const workout of workouts) {
		byDate.set(workout.localDate, [...(byDate.get(workout.localDate) ?? []), workout])
	}
	return [...byDate.entries()]
		.sort(([a], [b]) => b.localeCompare(a))
		.map(([localDate, dayWorkouts]) => ({ localDate, workouts: dayWorkouts.sort(byStart) }))
}

/** Months newest first, each with its days (see `groupWorkoutsByDay`). */
export const groupWorkoutsByMonth = (workouts: readonly WorkoutResponse[]): WorkoutMonthGroup[] => {
	const byMonth = new Map<string, WorkoutDayGroup[]>()
	for (const day of groupWorkoutsByDay(workouts)) {
		const monthKey = day.localDate.slice(0, MONTH_KEY_LENGTH)
		byMonth.set(monthKey, [...(byMonth.get(monthKey) ?? []), day])
	}
	return [...byMonth.entries()].map(([monthKey, days]) => ({ monthKey, days }))
}
