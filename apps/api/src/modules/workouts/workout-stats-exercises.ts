import type { WorkoutStatsExercise } from '@kus/shared'

import {
	getChange,
	getPointValue,
	getProgressPoints,
	getTopSet,
	getWorkingSets,
	isBodyweightExercise,
} from './exercise-progress'
import type { StatsEntryRow } from './workout-stats.types'
import { getMuscleGroup } from './workouts.mapper'

type Listed = { exerciseId: string; entries: StatsEntryRow[] }

/** Newest entry first: its name and group are the ones shown. */
const byNewest = (a: StatsEntryRow, b: StatsEntryRow): number =>
	b.workoutLocalDate.localeCompare(a.workoutLocalDate) || b.position - a.position

const groupByExercise = (entries: readonly StatsEntryRow[]): Listed[] => {
	const groups = new Map<string, StatsEntryRow[]>()
	for (const entry of entries) {
		if (entry.kind !== 'STRENGTH' || entry.exerciseId === null) continue
		groups.set(entry.exerciseId, [...(groups.get(entry.exerciseId) ?? []), entry])
	}
	return [...groups].map(([exerciseId, grouped]) => ({ exerciseId, entries: grouped }))
}

/**
 * The «Вправи» list: strength exercises of the period that have a dictionary id (old entries
 * without one are only in the overview). `allTimeEntries` are the strength entries of those
 * exercises over all time: best and bodyweight come from them, the trend from the period.
 */
export const buildExerciseList = (
	periodEntries: readonly StatsEntryRow[],
	allTimeEntries: readonly StatsEntryRow[],
): WorkoutStatsExercise[] => {
	const allTimeById = new Map(
		groupByExercise(allTimeEntries).map((item) => [item.exerciseId, item]),
	)
	return groupByExercise(periodEntries)
		.map(({ exerciseId, entries }): WorkoutStatsExercise => {
			const allTimeSets = getWorkingSets(allTimeById.get(exerciseId)?.entries ?? entries)
			const isBodyweight = isBodyweightExercise(allTimeSets)
			const trend = getProgressPoints(getWorkingSets(entries), isBodyweight).map(getPointValue)
			const newest = [...entries].sort(byNewest)[0] ?? entries[0]
			return {
				exerciseId,
				name: newest?.name ?? '',
				muscleGroup: newest ? getMuscleGroup(newest) : null,
				isBodyweight,
				sessionCount: new Set(entries.map((entry) => entry.workoutId)).size,
				setCount: getWorkingSets(entries).length,
				lastLocalDate: newest?.workoutLocalDate ?? '',
				best: getTopSet(allTimeSets, isBodyweight),
				change: getChange(trend),
				trend,
			}
		})
		.sort((a, b) => b.lastLocalDate.localeCompare(a.lastLocalDate) || a.name.localeCompare(b.name))
}
