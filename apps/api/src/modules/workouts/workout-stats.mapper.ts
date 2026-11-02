import { formatDbDate } from '../../common/time'
import type { StatsEntryRecord, StatsWorkoutRecord } from './workout-stats.repository'
import type { StatsEntryRow, StatsWorkoutRow } from './workout-stats.types'

export const toStatsWorkoutRow = (workout: StatsWorkoutRecord): StatsWorkoutRow => ({
	id: workout.id,
	localDate: formatDbDate(workout.localDate),
	durationMin: workout.durationMin,
	kcalBurned: workout.kcalBurned,
	kcalSource: workout.kcalSource,
	finishedAt: workout.finishedAt,
	finishedMessageId: workout.finishedMessageId,
	entries: workout.exercises,
})

/** The dictionary name is the consistent one; the snapshot on the entry is as the person wrote it. */
export const toStatsEntryRow = (entry: StatsEntryRecord): StatsEntryRow => ({
	workoutId: entry.workout?.id ?? '',
	workoutLocalDate: formatDbDate(entry.workout?.localDate ?? entry.localDate),
	position: entry.position,
	exerciseId: entry.exerciseId,
	name: entry.exercise?.name ?? entry.name,
	kind: entry.kind,
	muscleGroup: entry.muscleGroup,
	exercise: entry.exercise
		? { muscleGroup: entry.exercise.muscleGroup, isBodyweight: entry.exercise.isBodyweight }
		: null,
	isBodyweight: entry.isBodyweight,
	durationMin: entry.durationMin,
	distanceM: entry.distanceM,
	kcalBurned: entry.kcalBurned,
	source: entry.source,
	sets: entry.sets.map((set) => ({
		reps: set.reps,
		weightKg: set.weightKg === null ? null : set.weightKg.toNumber(),
		durationSec: set.durationSec,
		distanceM: set.distanceM,
		isWarmup: set.isWarmup,
	})),
})
