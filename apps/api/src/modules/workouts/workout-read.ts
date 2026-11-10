import {
	FOOD_SEARCH_LIMIT,
	formatSets,
	GET_WORKOUTS_EXERCISES_MAX,
	GET_WORKOUTS_KNOWN_EXERCISES_MAX,
	GET_WORKOUTS_SESSIONS_MAX,
	searchFoods,
	type WorkoutsReadData,
} from '@kus/shared'

import {
	getChange,
	getPointValue,
	getProgressPoints,
	getTopSet,
	getWorkingSets,
	isBodyweightExercise,
	roundNumber,
} from './exercise-progress'
import { buildReadProgram, type ReadProgramInput } from './workout-read-program'
import { countWorkingSets, getDurations } from './workout-stats'
import { addDays, MS_IN_DAY, toTime } from './workout-stats-period'
import type { StatsEntryRow, StatsWorkoutRow } from './workout-stats.types'
import { getBodyweightMaxReps } from './workout-records'
import { getEstimatedDurationMin } from './workouts.mapper'

/** Most exercises of the dictionary one spoken name can stand for. */
export const READ_EXERCISE_MATCH_LIMIT = 5
const RECORDS_MAX = 20
const KM_FACTOR = 10
const METERS_IN_KM = 1000

export interface ReadExerciseName {
	id: string
	name: string
	aliases: readonly string[]
}

/** The user's exercises that the words stand for, best match first. */
export const matchExercises = (
	query: string,
	exercises: readonly ReadExerciseName[],
): ReadExerciseName[] => {
	const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
	return searchFoods(
		query,
		exercises.map(({ id, name, aliases }) => ({ ref: id, source: 'saved', name, aliases })),
		{ limit: Math.min(FOOD_SEARCH_LIMIT, READ_EXERCISE_MATCH_LIMIT) },
	).flatMap(({ candidate }) => byId.get(candidate.ref) ?? [])
}

export interface BuildWorkoutsReadInput {
	from: string
	to: string
	/** The user's local today. */
	today: string
	firstEverDate: string | null
	totalEver: number
	/** The spoken exercise and the dictionary exercises it matched; null = all exercises. */
	exercise: { query: string; matched: readonly ReadExerciseName[] } | null
	/** Names of the user's exercises, shown when the spoken one matched nothing. */
	knownExerciseNames: readonly string[]
	/** Counted workouts with their date in [from, to]. */
	workouts: readonly StatsWorkoutRow[]
	/** Entries of those workouts. */
	entries: readonly StatsEntryRow[]
	/** Strength entries of the period's (or the matched) exercises over all time. */
	allTimeStrengthEntries: readonly StatsEntryRow[]
	program: ReadProgramInput | null
	hasOpenSession: boolean
}

type ReadSession = WorkoutsReadData['sessions'][number]

const KM_DECIMALS = 1

const formatEntrySummary = (entry: StatsEntryRow): string => {
	if (entry.kind === 'STRENGTH') {
		return formatSets(
			entry.sets
				.filter((set) => !set.isWarmup)
				.map((set) => ({ reps: set.reps, weightKg: set.weightKg, isWarmup: false })),
		)
	}
	return [
		entry.durationMin === null ? null : `${entry.durationMin} min`,
		entry.distanceM === null ? null : `${(entry.distanceM / METERS_IN_KM).toFixed(KM_DECIMALS)} km`,
	]
		.filter((part) => part !== null)
		.join(', ')
}

const byPosition = (a: StatsEntryRow, b: StatsEntryRow): number => a.position - b.position

const byNewest = (a: StatsWorkoutRow, b: StatsWorkoutRow): number =>
	b.localDate.localeCompare(a.localDate) || b.id.localeCompare(a.id)

const groupBy = <T>(items: readonly T[], getKey: (item: T) => string): Map<string, T[]> => {
	const groups = new Map<string, T[]>()
	for (const item of items) groups.set(getKey(item), [...(groups.get(getKey(item)) ?? []), item])
	return groups
}

const toSession = (workout: StatsWorkoutRow, entries: readonly StatsEntryRow[]): ReadSession => {
	const estimate = workout.durationMin === null ? getEstimatedDurationMin(workout) : null
	return {
		date: workout.localDate,
		templateName: workout.templateName,
		durationMin: workout.durationMin ?? estimate,
		isDurationEstimate: workout.durationMin === null && estimate !== null,
		exercises: [...entries].sort(byPosition).map((entry) => ({
			name: entry.name,
			summary: formatEntrySummary(entry),
			isRecord: workout.records.some((record) => record.exerciseEntryId === entry.id),
		})),
	}
}

const toTopSet = (
	set: ReturnType<typeof getTopSet>,
): WorkoutsReadData['exercises'][number]['bestInPeriod'] =>
	set === null ? null : { weightKg: set.weightKg, reps: set.reps }

const buildExerciseSummaries = (
	periodEntries: readonly StatsEntryRow[],
	allTimeEntries: readonly StatsEntryRow[],
): WorkoutsReadData['exercises'] => {
	const strength = periodEntries.filter(
		(entry) => entry.kind === 'STRENGTH' && entry.exerciseId !== null,
	)
	const allTimeById = groupBy(allTimeEntries, (entry) => entry.exerciseId ?? '')
	return [...groupBy(strength, (entry) => entry.exerciseId ?? '').entries()]
		.map(([exerciseId, entries]) => {
			const sets = getWorkingSets(entries)
			const allTimeSets = getWorkingSets(allTimeById.get(exerciseId) ?? entries)
			const isBodyweight = isBodyweightExercise(allTimeSets)
			const bestEver = getTopSet(allTimeSets, isBodyweight)
			const newest = [...entries].sort(
				(a, b) => b.workoutLocalDate.localeCompare(a.workoutLocalDate) || b.position - a.position,
			)[0]
			return {
				name: newest?.name ?? '',
				sessionCount: new Set(entries.map((entry) => entry.workoutId)).size,
				setCount: sets.length,
				bestInPeriod: toTopSet(getTopSet(sets, isBodyweight)),
				bestEver: toTopSet(bestEver),
				bestEverDate: bestEver?.localDate ?? null,
				change: getChange(getProgressPoints(sets, isBodyweight).map(getPointValue)),
			}
		})
		.sort(
			(a, b) =>
				b.sessionCount - a.sessionCount || b.setCount - a.setCount || a.name.localeCompare(b.name),
		)
		.slice(0, GET_WORKOUTS_EXERCISES_MAX)
}

const getRecordValue = (
	entry: StatsEntryRow,
	type: StatsWorkoutRow['records'][number]['type'],
): number | null => {
	if (type === 'DISTANCE') {
		return entry.distanceM === null
			? null
			: Math.round((entry.distanceM / METERS_IN_KM) * KM_FACTOR) / KM_FACTOR
	}
	if (type === 'REPS') return getBodyweightMaxReps(entry.sets)
	const weights = entry.sets.flatMap((set) =>
		!set.isWarmup && set.weightKg !== null && set.weightKg > 0 ? [set.weightKg] : [],
	)
	return weights.length === 0 ? null : roundNumber(Math.max(...weights))
}

const buildRecords = (
	workouts: readonly StatsWorkoutRow[],
	entries: readonly StatsEntryRow[],
): WorkoutsReadData['records'] => {
	const entryById = new Map(entries.map((entry) => [entry.id, entry]))
	return [...workouts]
		.sort(byNewest)
		.flatMap((workout) =>
			workout.records.flatMap(({ exerciseEntryId, type }) => {
				const entry = entryById.get(exerciseEntryId)
				const value = entry ? getRecordValue(entry, type) : null
				if (!entry || value === null || value <= 0) return []
				return [{ date: workout.localDate, exercise: entry.name, type, value }]
			}),
		)
		.slice(0, RECORDS_MAX)
}

const getDaysCovered = (from: string, to: string): number =>
	Math.round((toTime(to) - toTime(from)) / MS_IN_DAY) + 1

/**
 * Everything get_workouts tells the model, counted here so the model only quotes it. With an
 * exercise the sessions, the counts and the records are those that hold it; the program is always
 * judged against all workouts.
 */
export const buildWorkoutsReadData = (input: BuildWorkoutsReadInput): WorkoutsReadData => {
	const { from, to, today, exercise } = input
	const matchedIds = new Set(exercise?.matched.map(({ id }) => id))
	const entries =
		exercise === null
			? input.entries
			: input.entries.filter(
					(entry) => entry.exerciseId !== null && matchedIds.has(entry.exerciseId),
				)
	const holdingWorkoutIds = new Set(entries.map((entry) => entry.workoutId))
	const workouts =
		exercise === null
			? input.workouts
			: input.workouts.filter((workout) => holdingWorkoutIds.has(workout.id))
	const durations = getDurations(workouts)
	const newestFirst = [...workouts].sort(byNewest)
	const entriesByWorkout = groupBy(entries, (entry) => entry.workoutId)
	const dates = workouts.map((workout) => workout.localDate)
	return {
		from,
		to,
		days: getDaysCovered(from, to),
		firstEverDate: input.firstEverDate,
		totalEver: input.totalEver,
		exercise:
			exercise === null
				? null
				: { query: exercise.query, matched: exercise.matched.map(({ name }) => name) },
		...(exercise !== null && exercise.matched.length === 0
			? { knownExercises: input.knownExerciseNames.slice(0, GET_WORKOUTS_KNOWN_EXERCISES_MAX) }
			: {}),
		count: workouts.length,
		firstDate: dates.length === 0 ? null : dates.reduce((a, b) => (a < b ? a : b)),
		lastDate: dates.length === 0 ? null : dates.reduce((a, b) => (a > b ? a : b)),
		avgDurationMin:
			durations.named.length === 0
				? null
				: Math.round(
						durations.named.reduce((total, minutes) => total + minutes, 0) / durations.named.length,
					),
		hasEstimatedDuration: durations.hasEstimate,
		workingSets: countWorkingSets(entries),
		sessions: newestFirst
			.slice(0, GET_WORKOUTS_SESSIONS_MAX)
			.map((workout) => toSession(workout, entriesByWorkout.get(workout.id) ?? [])),
		olderNotListed: Math.max(0, workouts.length - GET_WORKOUTS_SESSIONS_MAX),
		exercises: buildExerciseSummaries(entries, input.allTimeStrengthEntries),
		records: buildRecords(workouts, entries),
		program:
			input.program === null
				? null
				: buildReadProgram({
						program: input.program,
						from,
						to,
						today,
						dates: input.workouts.map((workout) => workout.localDate),
					}),
		hasOpenSession: input.hasOpenSession,
	}
}

/** `from` of a period that ends on `to` and covers `days` days. */
export const getReadPeriodStart = (to: string, days: number): string => addDays(to, -(days - 1))
