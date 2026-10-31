import {
	type ExerciseContext,
	type TodayWorkoutContext,
	type WorkoutExerciseInput,
	type WorkoutRecordType,
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

/** Whole metres; a distance too short to round to one is none. */
export const toDistanceM = (km: number | null): number | null => {
	if (km === null) return null
	return Math.round(km * METRES_IN_KM) || null
}

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

/** The latest moment of the workout's live entries; null without any. */
export const getLastPerformedAt = (workout: Pick<WorkoutWithExercises, 'exercises'>): Date | null =>
	workout.exercises.reduce<Date | null>(
		(latest, exercise) =>
			latest === null || exercise.performedAt > latest ? exercise.performedAt : latest,
		null,
	)

export const toWorkoutContext = (
	workout: WorkoutWithExercises,
	{
		ref,
		time,
		lastAt,
		exerciseRefs,
	}: {
		ref: string
		time: string | null
		lastAt: string | null
		/** Dictionary id → its `x…` in «Exercises». */
		exerciseRefs: ReadonlyMap<string, string>
	},
): TodayWorkoutContext => ({
	ref,
	place: workout.place,
	time,
	lastAt,
	finished: workout.finishedAt !== null,
	durationMin: workout.durationMin,
	kcalBurned: workout.kcalBurned,
	exercises: workout.exercises.map((exercise) => ({
		name: exercise.name,
		exerciseRef:
			exercise.exerciseId === null ? null : (exerciseRefs.get(exercise.exerciseId) ?? null),
		// the dictionary row's group is the one shown; the entry's snapshot when the row is gone
		muscleGroup: exercise.exercise?.muscleGroup ?? exercise.muscleGroup,
		sets: exercise.sets.map(toSetContext),
		durationMin: exercise.durationMin,
		distanceKm: toKm(exercise.distanceM),
	})),
})

export const toExerciseContext = (
	exercise: {
		name: string
		kind: ExerciseContext['kind']
		muscleGroup: NonNullable<ExerciseContext['muscleGroup']> | null
	},
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
	muscleGroup: exercise.muscleGroup,
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

export type WorkoutRecord = { exerciseEntryId: string; type: WorkoutRecordType }

/** A record is a result above everything before it: a first result is none. */
export const isRecord = (before: number | null, now: number | null): boolean =>
	before !== null && before > 0 && now !== null && now > before

type RecordSet = {
	reps: number | null
	weightKg: { toNumber: () => number } | null
	isWarmup: boolean
}

/** Weight 0 is «without weight» too: the model writes it for pull-ups as often as null. */
const hasWeight = (set: RecordSet): boolean => set.weightKg !== null && set.weightKg.toNumber() > 0

/**
 * The most reps in a working set of an exercise done without weight, the result a REPS record is
 * about. Null when a working set has weight (the record is then WEIGHT), or there are no reps;
 * warm-up sets never count.
 */
export const getBodyweightMaxReps = (sets: readonly RecordSet[]): number | null => {
	const working = sets.filter((set) => !set.isWarmup)
	if (working.length === 0 || working.some(hasWeight)) return null
	const reps = working.flatMap((set) => (set.reps === null ? [] : [set.reps]))
	return reps.length === 0 ? null : Math.max(...reps)
}
