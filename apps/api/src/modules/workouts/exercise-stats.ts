import {
	type ExerciseKind,
	type ExerciseStatsResponse,
	type MuscleGroup,
	type WorkoutRecordType,
	type WorkoutStatsPeriod,
} from '@kus/shared'

import {
	getChange,
	getMaxRepsSet,
	getMaxSessionReps,
	getPointValue,
	getProgressPoints,
	getTopSet,
	getWorkingSets,
	isBodyweightExercise,
} from './exercise-progress'
import {
	computeChronologicalRecords,
	type RecordEntryInput,
	resolveIsBodyweight,
} from './workout-records'
import { getStatsPeriodRange, isInRange } from './workout-stats-period'
import type { StatsEntryRow } from './workout-stats.types'

export const EXERCISE_HISTORY_LIMIT = 20

export type StatsExerciseRow = {
	id: string
	name: string
	kind: ExerciseKind
	muscleGroup: MuscleGroup | null
}

type HistoryItem = ExerciseStatsResponse['history'][number]

/** The screen shows one trophy per session. */
const RECORD_PRIORITY: readonly WorkoutRecordType[] = ['WEIGHT', 'REPS', 'DISTANCE']

const toRecordEntry = (entry: StatsEntryRow): RecordEntryInput | null => {
	if (entry.exerciseId === null) return null
	return {
		entryId: entry.id,
		workoutId: entry.workoutId,
		exerciseId: entry.exerciseId,
		performedAt: entry.performedAt,
		position: entry.position,
		distanceM: entry.distanceM,
		isBodyweight: resolveIsBodyweight({
			entryFlag: entry.isBodyweight,
			exerciseFlag: entry.exercise?.isBodyweight,
			name: entry.name,
		}),
		sets: entry.sets,
	}
}

/** The trophy of each session by the same rule the journal uses (chronological). */
const getSessionRecords = (entries: readonly StatsEntryRow[]): Map<string, WorkoutRecordType> => {
	const records = computeChronologicalRecords(
		entries.flatMap((entry) => toRecordEntry(entry) ?? []),
	)
	const result = new Map<string, WorkoutRecordType>()
	for (const [workoutId, sessionRecords] of records) {
		const type = RECORD_PRIORITY.find((candidate) =>
			sessionRecords.some((record) => record.type === candidate),
		)
		if (type !== undefined) result.set(workoutId, type)
	}
	return result
}

const toHistory = (entries: readonly StatsEntryRow[]): HistoryItem[] => {
	const records = getSessionRecords(entries)
	const byWorkout = new Map<string, StatsEntryRow[]>()
	for (const entry of entries) {
		byWorkout.set(entry.workoutId, [...(byWorkout.get(entry.workoutId) ?? []), entry])
	}
	return [...byWorkout]
		.map(([workoutId, workoutEntries]): HistoryItem => {
			const ordered = [...workoutEntries].sort((a, b) => a.position - b.position)
			return {
				workoutId,
				localDate: ordered[0]?.workoutLocalDate ?? '',
				record: records.get(workoutId) ?? null,
				// warm-ups are shown here, and only here
				sets: ordered.flatMap((entry) =>
					entry.sets.map((set) => ({
						reps: set.reps,
						weightKg: set.weightKg,
						durationSec: set.durationSec,
						distanceM: set.distanceM,
						isWarmup: set.isWarmup,
						doneAt: null,
					})),
				),
			}
		})
		.sort(
			(a, b) => b.localDate.localeCompare(a.localDate) || b.workoutId.localeCompare(a.workoutId),
		)
		.slice(0, EXERCISE_HISTORY_LIMIT)
}

/**
 * The whole `GET /workouts/exercises/:exerciseId` answer. `entries` are every live entry of this
 * exercise over all time: the best is all-time, the points and the change are for the period.
 */
export const buildExerciseStats = ({
	exercise,
	period,
	today,
	entries,
}: {
	exercise: StatsExerciseRow
	period: WorkoutStatsPeriod
	today: string
	entries: readonly StatsEntryRow[]
}): ExerciseStatsResponse => {
	const range = getStatsPeriodRange(period, today)
	const sets = getWorkingSets(entries)
	const isBodyweight = isBodyweightExercise(sets)
	const points = getProgressPoints(
		sets.filter((set) => isInRange(set.localDate, range)),
		isBodyweight,
	)
	return {
		period,
		from: range.from,
		to: range.to,
		exercise: { ...exercise, isBodyweight },
		best: {
			topSet: getTopSet(sets, isBodyweight),
			maxReps: getMaxRepsSet(sets, isBodyweight),
			maxSessionReps: isBodyweight ? getMaxSessionReps(sets) : null,
		},
		change: getChange(points.map(getPointValue)),
		changeReps: getChange(points.map((point) => point.maxReps)),
		points: points.map(({ localDate, workoutId, topWeightKg, maxReps }) => ({
			localDate,
			workoutId,
			topWeightKg,
			maxReps,
		})),
		history: toHistory(entries),
	}
}
