import type { WorkoutRecordType, WorkoutStatsTopSet } from '@kus/shared'

import type { StatsEntryRow } from './workout-stats.types'

export type WorkingSet = {
	workoutId: string
	localDate: string
	reps: number
	weightKg: number | null
}

export type ProgressPoint = {
	workoutId: string
	localDate: string
	topWeightKg: number | null
	maxReps: number
}

const CHANGE_DECIMALS = 100

/** Weights are decimals (67.5): no float noise in sums and differences. */
export const roundNumber = (value: number): number =>
	Math.round(value * CHANGE_DECIMALS) / CHANGE_DECIMALS

const isWeighted = (weightKg: number | null): weightKg is number =>
	weightKg !== null && weightKg > 0

/** Warm-up sets count nowhere; a set without reps counts as 0 reps. */
export const getWorkingSets = (entries: readonly StatsEntryRow[]): WorkingSet[] =>
	entries.flatMap((entry) =>
		entry.sets
			.filter((set) => !set.isWarmup)
			.map((set) => ({
				workoutId: entry.workoutId,
				localDate: entry.workoutLocalDate,
				reps: set.reps ?? 0,
				weightKg: isWeighted(set.weightKg) ? set.weightKg : null,
			})),
	)

/** Bodyweight: every working set of the exercise has no weight (null or 0). */
export const isBodyweightExercise = (sets: readonly WorkingSet[]): boolean =>
	sets.every((set) => set.weightKg === null)

const pickBy = (
	sets: readonly WorkingSet[],
	isBetter: (candidate: WorkingSet, current: WorkingSet) => boolean,
): WorkingSet | null =>
	sets.reduce<WorkingSet | null>(
		(current, candidate) =>
			current === null || isBetter(candidate, current) ? candidate : current,
		null,
	)

const isEarlier = (candidate: WorkingSet, current: WorkingSet): boolean =>
	candidate.localDate < current.localDate

const isMoreReps = (candidate: WorkingSet, current: WorkingSet): boolean =>
	candidate.reps > current.reps ||
	(candidate.reps === current.reps && isEarlier(candidate, current))

const getMaxWeight = (sets: readonly WorkingSet[]): number | null =>
	sets.reduce<number | null>(
		(max, set) =>
			set.weightKg !== null && (max === null || set.weightKg > max) ? set.weightKg : max,
		null,
	)

const toTopSet = (set: WorkingSet | null): WorkoutStatsTopSet | null =>
	set === null ? null : { weightKg: set.weightKg, reps: set.reps, localDate: set.localDate }

/** The working sets at the heaviest weight; all of them for a bodyweight exercise. */
const getSetsAtTop = (sets: readonly WorkingSet[], isBodyweight: boolean): WorkingSet[] => {
	if (isBodyweight) return [...sets]
	const maxWeight = getMaxWeight(sets)
	return sets.filter((set) => set.weightKg === maxWeight)
}

/** The most reps in a set; ties go to the earlier date. */
const getMostReps = (sets: readonly WorkingSet[]): WorkingSet | null => pickBy(sets, isMoreReps)

/**
 * All-time best: the heaviest working set (its reps are the most at that weight, its date the first
 * time the weight was reached); for a bodyweight exercise the set with the most reps.
 */
export const getTopSet = (
	sets: readonly WorkingSet[],
	isBodyweight: boolean,
): WorkoutStatsTopSet | null => {
	const topSets = getSetsAtTop(sets, isBodyweight)
	const mostReps = getMostReps(topSets)
	if (mostReps === null) return null
	const firstReached = pickBy(topSets, isEarlier)
	return toTopSet({
		...mostReps,
		localDate: isBodyweight ? mostReps.localDate : (firstReached?.localDate ?? mostReps.localDate),
	})
}

/**
 * The workout where the all-time record was first reached: the heaviest working weight, or for a
 * bodyweight exercise the most reps in a set. Same-day ties go to the smaller workoutId (the
 * earlier one in the history order).
 */
export const getRecordWorkout = (
	sets: readonly WorkingSet[],
	isBodyweight: boolean,
): { workoutId: string; record: WorkoutRecordType } | null => {
	const topSets = getSetsAtTop(sets, isBodyweight)
	const maxReps = Math.max(0, ...topSets.map((set) => set.reps))
	const candidates = isBodyweight ? topSets.filter((set) => set.reps === maxReps) : topSets
	const first = pickBy(
		candidates,
		(candidate, current) =>
			candidate.localDate < current.localDate ||
			(candidate.localDate === current.localDate && candidate.workoutId < current.workoutId),
	)
	if (first === null || (isBodyweight && maxReps === 0)) return null
	return { workoutId: first.workoutId, record: isBodyweight ? 'REPS' : 'WEIGHT' }
}

/** Weighted: the most reps at the heaviest working weight; bodyweight: the most reps in a set. */
export const getMaxRepsSet = (
	sets: readonly WorkingSet[],
	isBodyweight: boolean,
): WorkoutStatsTopSet | null => toTopSet(getMostReps(getSetsAtTop(sets, isBodyweight)))

/** Bodyweight only: the most working reps summed over one workout. */
export const getMaxSessionReps = (
	sets: readonly WorkingSet[],
): { reps: number; localDate: string } | null => {
	const totals = new Map<string, { reps: number; localDate: string }>()
	for (const set of sets) {
		const total = totals.get(set.workoutId) ?? { reps: 0, localDate: set.localDate }
		totals.set(set.workoutId, { reps: total.reps + set.reps, localDate: set.localDate })
	}
	return [...totals.values()].reduce<{ reps: number; localDate: string } | null>(
		(best, total) =>
			best === null ||
			total.reps > best.reps ||
			(total.reps === best.reps && total.localDate < best.localDate)
				? total
				: best,
		null,
	)
}

/**
 * One point per workout, oldest first: the top working weight and the most reps at it; for a
 * bodyweight exercise no weight and the most reps in one set.
 */
export const getProgressPoints = (
	sets: readonly WorkingSet[],
	isBodyweight: boolean,
): ProgressPoint[] => {
	const byWorkout = new Map<string, WorkingSet[]>()
	for (const set of sets)
		byWorkout.set(set.workoutId, [...(byWorkout.get(set.workoutId) ?? []), set])
	const points: ProgressPoint[] = []
	for (const [workoutId, workoutSets] of byWorkout) {
		const top = getMostReps(getSetsAtTop(workoutSets, isBodyweight))
		if (top === null || (!isBodyweight && top.weightKg === null)) continue
		points.push({
			workoutId,
			localDate: top.localDate,
			topWeightKg: isBodyweight ? null : top.weightKg,
			maxReps: top.reps,
		})
	}
	return points.sort(
		(a, b) => a.localDate.localeCompare(b.localDate) || a.workoutId.localeCompare(b.workoutId),
	)
}

/** The number a point is drawn with: the weight, or the reps of a bodyweight exercise. */
export const getPointValue = (point: ProgressPoint): number => point.topWeightKg ?? point.maxReps

/** Last point minus the first; null with fewer than two. */
export const getChange = (values: readonly number[]): number | null => {
	const first = values[0]
	const last = values[values.length - 1]
	if (values.length < 2 || first === undefined || last === undefined) return null
	return roundNumber(last - first)
}
