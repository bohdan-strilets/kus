import { countSets, type FoodParseDecision, type LogWorkoutInput } from '@kus/shared'

import type { LoggedWorkout } from './eval.types.js'

const toMaxWeight = (weights: (number | null)[]): number | null =>
	weights.reduce<number | null>(
		(max, weight) => (weight !== null && (max === null || weight > max) ? weight : max),
		null,
	)

const toLoggedWorkout = (workout: LogWorkoutInput): LoggedWorkout => ({
	place: workout.place,
	durationMin: workout.durationMin,
	kcalBurned: workout.kcalBurned,
	replaceRef: workout.replaceRef,
	exercises: workout.exercises.map((exercise) => {
		const working = exercise.sets.filter((set) => !set.isWarmup)
		return {
			name: exercise.name,
			kind: exercise.kind,
			exerciseRef: exercise.exerciseRef,
			sets: countSets(exercise),
			warmupSets: exercise.sets
				.filter((set) => set.isWarmup)
				.reduce((total, set) => total + set.count, 0),
			maxWeightKg: toMaxWeight(working.map((set) => set.weightKg)),
			reps: working[0]?.reps ?? null,
			durationMin: exercise.durationMin,
			distanceKm: exercise.distanceKm,
		}
	}),
})

/** The trainings of a valid answer: `workout` and `log` (food and training together) carry them. */
export const getLoggedWorkouts = (decision: FoodParseDecision): LoggedWorkout[] => {
	if (decision.kind !== 'workout' && decision.kind !== 'log') return []
	return decision.workouts.map(toLoggedWorkout)
}
