// What the model sees of workouts: today's sessions, the ones deleted today and the user's exercise
// dictionary, each under a short ref. The backend keeps the ref → id map of the request (IDOR).
import type { ExerciseKind, MuscleGroup, WorkoutPlace } from '../schemas/enums.js'

/** Newest last; the dictionary lines are the exercises the message names, as with saved foods. */
export const MAX_CONTEXT_WORKOUTS = 5
export const MAX_CONTEXT_DELETED_WORKOUTS = 3
export const MAX_CONTEXT_EXERCISES = 10
/**
 * A session whose last entry is at most this old is still open: one of the day before (a night
 * workout) is listed with today's, and more of it is added with appendRef.
 */
export const WORKOUT_APPEND_MAX_GAP_HOURS = 3
const MS_IN_HOUR = 60 * 60 * 1000
const APPEND_MAX_GAP_MS = WORKOUT_APPEND_MAX_GAP_HOURS * MS_IN_HOUR

/** The earliest last entry a still open session can have. */
export const getOpenWorkoutSince = (now: Date): Date => new Date(now.getTime() - APPEND_MAX_GAP_MS)

/** A session is open while its last entry is at most WORKOUT_APPEND_MAX_GAP_HOURS old. */
export const isWorkoutOpen = (lastPerformedAt: Date, now: Date): boolean =>
	now.getTime() - lastPerformedAt.getTime() <= APPEND_MAX_GAP_MS

/** One set of an exercise, as stored (a «3×8 80» group is three of these). */
export interface WorkoutSetContext {
	reps: number | null
	weightKg: number | null
	isWarmup: boolean
}

export interface WorkoutExerciseContext {
	name: string
	/** Its `x…` in «Exercises», when listed there. */
	exerciseRef?: string | null
	/** Null for cardio and an exercise without a group. */
	muscleGroup?: MuscleGroup | null
	sets: WorkoutSetContext[]
	durationMin: number | null
	distanceKm: number | null
}

export interface TodayWorkoutContext {
	/** `w1`… — numbered by the backend, unique across today's and deleted workouts of the request. */
	ref: string
	place: WorkoutPlace | null
	/** The user's local `HH:mm` of the workout; null when it has no time. */
	time: string | null
	/** The user's local `HH:mm` of the latest entry; null when the workout has no time. */
	lastAt?: string | null
	/** The user said it is over («все»). */
	finished?: boolean
	durationMin: number | null
	/** Only a number the user said. */
	kcalBurned: number | null
	exercises: WorkoutExerciseContext[]
}

/** The last time the exercise was done, so the model can name the same one and compare. */
export interface ExerciseContext {
	/** `x1`… */
	ref: string
	name: string
	kind: ExerciseKind
	/** Null for cardio and an exercise without a group. */
	muscleGroup?: MuscleGroup | null
	last: {
		/** `YYYY-MM-DD` */
		date: string
		sets: WorkoutSetContext[]
		durationMin: number | null
		distanceKm: number | null
	} | null
}

const KM_DECIMALS = 1

/** «3×8 at 80 kg» for each run of equal consecutive sets; a warm-up run is marked. */
export const formatSets = (sets: readonly WorkoutSetContext[]): string => {
	const groups: { set: WorkoutSetContext; count: number }[] = []
	for (const set of sets) {
		const last = groups.at(-1)
		const isSame =
			last !== undefined &&
			last.set.reps === set.reps &&
			last.set.weightKg === set.weightKg &&
			last.set.isWarmup === set.isWarmup
		if (isSame) last.count += 1
		else groups.push({ set, count: 1 })
	}
	return groups
		.map(({ set, count }) => {
			const amount = set.reps === null ? `${count} sets` : `${count}×${set.reps}`
			const weight = set.weightKg === null ? '' : ` at ${set.weightKg} kg`
			return `${set.isWarmup ? 'warm-up ' : ''}${amount}${weight}`
		})
		.join(', ')
}

const formatEffort = ({
	sets,
	durationMin,
	distanceKm,
}: {
	sets: readonly WorkoutSetContext[]
	durationMin: number | null
	distanceKm: number | null
}): string =>
	[
		sets.length > 0 ? formatSets(sets) : null,
		durationMin === null ? null : `${durationMin} min`,
		distanceKm === null ? null : `${distanceKm.toFixed(KM_DECIMALS)} km`,
	]
		.filter((part) => part !== null)
		.join(', ')

/** «[x2 CHEST]»: where the exercise sits in «Exercises» and its group; nothing when neither is known. */
const formatExerciseTag = ({ exerciseRef, muscleGroup }: WorkoutExerciseContext): string => {
	const tag = [exerciseRef ?? null, muscleGroup ?? null].filter((part) => part !== null).join(' ')
	return tag === '' ? '' : ` [${tag}]`
}

const formatWorkoutExercise = (exercise: WorkoutExerciseContext): string => {
	const effort = formatEffort(exercise)
	const head = `"${exercise.name}"${formatExerciseTag(exercise)}`
	return effort === '' ? head : `${head} ${effort}`
}

/**
 * «w1 GYM 18:30, last 19:05, 55 min, finished: "Жим лежачи" [x2 CHEST] 3×8 at 80 kg; … Burned:
 * 320 kcal (said by the user)».
 */
export const formatWorkout = (workout: TodayWorkoutContext): string => {
	const when = [
		workout.time,
		workout.lastAt ? `last ${workout.lastAt}` : null,
		workout.durationMin === null ? null : `${workout.durationMin} min`,
		workout.finished ? 'finished' : null,
	]
		.filter((part) => part !== null)
		.join(', ')
	// without a time the duration follows the place after a comma: «w2 OUTDOOR, 31 min»
	const separator = workout.time === null && workout.place !== null ? ', ' : ' '
	const place = workout.place === null ? '' : ` ${workout.place}`
	const head = `${workout.ref}${place}${when === '' ? '' : `${separator}${when}`}`
	const exercises = workout.exercises.map(formatWorkoutExercise).join('; ')
	const burned =
		workout.kcalBurned === null ? '' : `. Burned: ${workout.kcalBurned} kcal (said by the user)`
	return `- ${head}: ${exercises}${burned}`
}

/** «x1 "Жим лежачи" (STRENGTH, CHEST): 3×8 at 80 kg on 2026-10-23». */
export const formatExercise = (exercise: ExerciseContext): string => {
	const kind = exercise.muscleGroup ? `${exercise.kind}, ${exercise.muscleGroup}` : exercise.kind
	const head = `- ${exercise.ref} "${exercise.name}" (${kind})`
	if (exercise.last === null) return head
	const effort = formatEffort(exercise.last)
	return `${head}: ${effort === '' ? 'done' : effort} on ${exercise.last.date}`
}
