import {
	countSets,
	type ExerciseContext,
	type LogWorkoutInput,
	type TodayWorkoutContext,
	type WorkoutExerciseInput,
	type WorkoutSetContext,
} from '@kus/shared'

import { formatDbDate } from '../../common/time'
import type { ExerciseWrite, WorkoutWithExercises } from './workouts.repository'

const METRES_IN_KM = 1000
const KM_DECIMALS = 3

/** «3×8 80» is three sets: the groups of the tool become the rows of the table. */
export const expandSets = (exercise: Pick<WorkoutExerciseInput, 'sets'>): ExerciseWrite['sets'] => {
	const rows: ExerciseWrite['sets'] = []
	for (const group of exercise.sets) {
		for (let index = 0; index < group.count; index += 1) {
			rows.push({
				position: rows.length,
				reps: group.reps,
				weightKg: group.weightKg,
				isWarmup: group.isWarmup,
			})
		}
	}
	return rows
}

export const toDistanceM = (km: number | null): number | null =>
	km === null ? null : Math.round(km * METRES_IN_KM)

/** The set count the tool allows, checked once more where the rows are made. */
export const hasTooManySets = (workout: LogWorkoutInput, max: number): boolean =>
	workout.exercises.some((exercise) => countSets(exercise) > max)

const toSetContext = (set: {
	reps: number | null
	weightKg: { toNumber: () => number } | null
	isWarmup: boolean
}): WorkoutSetContext => ({
	reps: set.reps,
	weightKg: set.weightKg === null ? null : set.weightKg.toNumber(),
	isWarmup: set.isWarmup,
})

const toKm = (distanceM: number | null): number | null =>
	distanceM === null ? null : Number((distanceM / METRES_IN_KM).toFixed(KM_DECIMALS))

export const toWorkoutContext = (
	workout: WorkoutWithExercises,
	{ ref, time }: { ref: string; time: string | null },
): TodayWorkoutContext => ({
	ref,
	place: workout.place,
	time,
	durationMin: workout.durationMin,
	kcalBurned: workout.kcalBurned,
	exercises: workout.exercises.map((exercise) => ({
		name: exercise.name,
		sets: exercise.sets.map(toSetContext),
		durationMin: exercise.durationMin,
		distanceKm: toKm(exercise.distanceM),
	})),
})

export const toExerciseContext = (
	exercise: { name: string; kind: ExerciseContext['kind'] },
	{
		ref,
		last,
	}: {
		ref: string
		last: {
			localDate: Date
			durationMin: number | null
			distanceM: number | null
			sets: Parameters<typeof toSetContext>[0][]
		} | null
	},
): ExerciseContext => ({
	ref,
	name: exercise.name,
	kind: exercise.kind,
	last:
		last === null
			? null
			: {
					date: formatDbDate(last.localDate),
					sets: last.sets.map(toSetContext),
					durationMin: last.durationMin,
					distanceKm: toKm(last.distanceM),
				},
})

export type WorkoutRecord = { exerciseEntryId: string; type: 'WEIGHT' | 'DISTANCE' }

/** A record is a result above everything before it: a first result is none. */
export const isRecord = (before: number | null, now: number | null): boolean =>
	before !== null && before > 0 && now !== null && now > before
