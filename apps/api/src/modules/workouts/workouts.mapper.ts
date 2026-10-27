import type { WorkoutResponse } from '@kus/shared'

import { formatDbDate } from '../../common/time'
import type { WorkoutWithExercises } from './workouts.repository'

export const toWorkoutResponse = (workout: WorkoutWithExercises): WorkoutResponse => ({
	id: workout.id,
	localDate: formatDbDate(workout.localDate),
	startedAt: workout.startedAt?.toISOString() ?? null,
	durationMin: workout.durationMin,
	place: workout.place,
	kcalBurned: workout.kcalBurned,
	kcalSource: workout.kcalSource,
	exercises: workout.exercises.map((exercise) => ({
		id: exercise.id,
		name: exercise.name,
		kind: exercise.kind,
		durationMin: exercise.durationMin,
		distanceM: exercise.distanceM,
		sets: exercise.sets.map((set) => ({
			reps: set.reps,
			weightKg: set.weightKg === null ? null : set.weightKg.toNumber(),
			durationSec: set.durationSec,
			distanceM: set.distanceM,
			isWarmup: set.isWarmup,
		})),
	})),
})
