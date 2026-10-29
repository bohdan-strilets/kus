import type { ExpectedWorkout, ExpectedWorkoutExercise } from './cases/case.types.js'
import type { LoggedWorkout, LoggedWorkoutExercise } from './eval.types.js'

const DISTANCE_TOLERANCE_KM = 0.05
const WEIGHT_TOLERANCE_KG = 0.01
const EXACT = 0

const isNear = (want: number | undefined, got: number | null, tolerance: number): boolean =>
	want === undefined || (got !== null && Math.abs(got - want) <= tolerance)

const isExerciseRight = (want: ExpectedWorkoutExercise, got: LoggedWorkoutExercise): boolean =>
	got.name.toLowerCase().includes(want.nameIncludes) &&
	(want.kind === undefined || got.kind === want.kind) &&
	(want.sets === undefined || got.sets === want.sets) &&
	(want.warmupSets === undefined || got.warmupSets === want.warmupSets) &&
	(want.reps === undefined || got.reps === want.reps) &&
	(want.exerciseRef === undefined || got.exerciseRef === want.exerciseRef) &&
	isNear(want.weightKg, got.maxWeightKg, WEIGHT_TOLERANCE_KG) &&
	isNear(want.durationMin, got.durationMin, EXACT) &&
	isNear(want.distanceKm, got.distanceKm, DISTANCE_TOLERANCE_KM)

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

const isWorkoutRight = (want: ExpectedWorkout, got: LoggedWorkout): boolean =>
	(want.place === undefined || got.place === want.place) &&
	(want.durationMin === undefined || got.durationMin === want.durationMin) &&
	(want.kcalBurned === undefined || got.kcalBurned === want.kcalBurned) &&
	(want.replaceRef === undefined || got.replaceRef === want.replaceRef) &&
	matchAll(want.exercises, got.exercises, isExerciseRight)

/** Exactly the expected trainings were logged (`[]` = none), each with its expected exercises. */
export const isWorkoutsCorrect = (expected: ExpectedWorkout[], actual: LoggedWorkout[]): boolean =>
	matchAll(expected, actual, isWorkoutRight)
