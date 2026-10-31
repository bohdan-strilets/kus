import type { MuscleGroup } from '@kus/shared'

import type { ExpectedWorkout, ExpectedWorkoutExercise } from './cases/case.types.js'
import type { LoggedWorkout, LoggedWorkoutExercise } from './eval.types.js'

const DISTANCE_TOLERANCE_KM = 0.05
const WEIGHT_TOLERANCE_KG = 0.01
const EXACT = 0

const isNear = (want: number | undefined, got: number | null, tolerance: number): boolean =>
	want === undefined || (got !== null && Math.abs(got - want) <= tolerance)

/** null = no weight may be logged; a number = the heaviest working weight within the tolerance. */
const isWeightRight = (want: number | null | undefined, got: number | null): boolean =>
	want === null ? got === null : isNear(want, got, WEIGHT_TOLERANCE_KG)

/** The group the backend stores: none for cardio, else the dictionary's over the model's. */
const getStoredGroup = (got: LoggedWorkoutExercise): MuscleGroup | null =>
	got.kind === 'CARDIO' ? null : (got.dictionaryGroup ?? got.muscleGroup)

const isGroupRight = (want: ExpectedWorkoutExercise, got: LoggedWorkoutExercise): boolean => {
	if (want.muscleGroup === undefined) return true
	const group = want.isModelGroup ? got.muscleGroup : getStoredGroup(got)
	return group === want.muscleGroup
}

const isExerciseRight = (want: ExpectedWorkoutExercise, got: LoggedWorkoutExercise): boolean =>
	got.name.toLowerCase().includes(want.nameIncludes) &&
	(want.kind === undefined || got.kind === want.kind) &&
	(want.sets === undefined || got.sets === want.sets) &&
	(want.warmupSets === undefined || got.warmupSets === want.warmupSets) &&
	(want.reps === undefined || got.reps === want.reps) &&
	(want.exerciseRef === undefined || got.exerciseRef === want.exerciseRef) &&
	isWeightRight(want.weightKg, got.maxWeightKg) &&
	isNear(want.durationMin, got.durationMin, EXACT) &&
	isNear(want.distanceKm, got.distanceKm, DISTANCE_TOLERANCE_KM) &&
	isGroupRight(want, got)

/** Takes a match out of the pool: every expected item is found once, and nothing extra is left. */
const matchAll = <Want, Got>(
	wants: readonly Want[],
	gots: readonly Got[],
	isMatch: (want: Want, got: Got) => boolean,
): boolean => {
	if (wants.length !== gots.length) return false
	const pool = [...gots]
	return wants.every((want) => {
		const index = pool.findIndex((candidate) => isMatch(want, candidate))
		if (index === -1) return false
		pool.splice(index, 1)
		return true
	})
}

const isSameSet = (want: readonly string[] | undefined, got: readonly string[]): boolean =>
	want === undefined || matchAll(want, got, (a, b) => a === b)

const isWorkoutRight = (want: ExpectedWorkout, got: LoggedWorkout): boolean =>
	(want.date === undefined || got.date === want.date) &&
	(want.place === undefined || got.place === want.place) &&
	(want.durationMin === undefined || got.durationMin === want.durationMin) &&
	(want.kcalBurned === undefined || got.kcalBurned === want.kcalBurned) &&
	(want.replaceRef === undefined || got.replaceRef === want.replaceRef) &&
	(want.appendRef === undefined || got.appendRef === want.appendRef) &&
	(want.finish === undefined || got.finish === want.finish) &&
	isSameSet(want.exerciseGroups, got.exerciseGroups) &&
	matchAll(want.exercises, got.exercises, isExerciseRight)

/** Exactly the expected trainings were logged (`[]` = none), each with its expected exercises. */
export const isWorkoutsCorrect = (expected: ExpectedWorkout[], actual: LoggedWorkout[]): boolean =>
	matchAll(expected, actual, isWorkoutRight)
