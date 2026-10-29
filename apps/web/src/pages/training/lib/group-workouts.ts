import type { WorkoutResponse } from '@kus/shared'

export interface WorkoutDayGroup {
	localDate: string
	workouts: WorkoutResponse[]
}

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
