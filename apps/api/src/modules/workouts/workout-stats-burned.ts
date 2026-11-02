import type { WorkoutStatsResponse } from '@kus/shared'

import { estimateWorkoutKcal } from './workout-kcal'
import type { StatsEntryRow, StatsWorkoutRow } from './workout-stats.types'

/** The body weight (kg) of a `YYYY-MM-DD` day; null when unknown. */
export type BodyWeightOfDay = (localDate: string) => number | null

export const NO_BODY_WEIGHT: BodyWeightOfDay = () => null

/**
 * The calories of the period: what was named plus the estimate for the rest of the workouts.
 * null when no workout gave a number (no body weight and nothing named).
 */
export const getBurned = ({
	workouts,
	entries,
	getBodyWeightKg,
}: {
	workouts: readonly StatsWorkoutRow[]
	entries: readonly StatsEntryRow[]
	getBodyWeightKg: BodyWeightOfDay
}): WorkoutStatsResponse['overview']['burned'] => {
	const byWorkout = new Map<string, StatsEntryRow[]>()
	for (const entry of entries) {
		byWorkout.set(entry.workoutId, [...(byWorkout.get(entry.workoutId) ?? []), entry])
	}
	let kcal = 0
	let hasValue = false
	let isEstimate = false
	for (const workout of workouts) {
		const result = estimateWorkoutKcal({
			workout: { ...workout, exercises: byWorkout.get(workout.id) ?? [] },
			bodyWeightKg: getBodyWeightKg(workout.localDate),
		})
		if (result === null) continue
		hasValue = true
		kcal += result.value
		isEstimate ||= result.source === 'ESTIMATE'
	}
	return hasValue ? { kcal, isEstimate } : null
}
