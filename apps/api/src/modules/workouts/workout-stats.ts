import { normalizeExerciseName, TRAINING_GROUP_ORDER } from '@kus/shared'
import type {
	MuscleGroup,
	WorkoutStatsBucket,
	WorkoutStatsGroup,
	WorkoutStatsPeriod,
	WorkoutStatsResponse,
} from '@kus/shared'

import { getWorkingSets } from './exercise-progress'
import { buildExerciseList } from './workout-stats-exercises'
import { type BodyWeightOfDay, getBurned, NO_BODY_WEIGHT } from './workout-stats-burned'
import {
	DAYS_IN_WEEK,
	type DateRange,
	getStatsPeriodRange,
	getWeekStart,
	isInRange,
	MS_IN_DAY,
	type StatsBucketRange,
	toTime,
} from './workout-stats-period'
import type { StatsEntryRow, StatsWorkoutRow } from './workout-stats.types'
import { getEstimatedDurationMin, getMuscleGroup } from './workouts.mapper'

type Cardio = WorkoutStatsResponse['cardio']

const MUSCLE_GROUP_ORDER = TRAINING_GROUP_ORDER.filter(
	(group): group is Exclude<typeof group, 'CARDIO'> => group !== 'CARDIO',
)

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)

const countWorkingSets = (entries: readonly StatsEntryRow[]): number =>
	getWorkingSets(entries.filter((entry) => entry.kind === 'STRENGTH')).length

const getStrengthKey = (entry: StatsEntryRow): string =>
	entry.exerciseId ?? `name:${normalizeExerciseName(entry.name)}`

const countStrengthExercises = (entries: readonly StatsEntryRow[]): number =>
	new Set(
		entries
			.filter((entry) => entry.kind === 'STRENGTH' && getWorkingSets([entry]).length > 0)
			.map(getStrengthKey),
	).size

const getGroups = (entries: readonly StatsEntryRow[]): WorkoutStatsGroup[] => {
	const counts = new Map<MuscleGroup | null, number>()
	for (const entry of entries) {
		if (entry.kind !== 'STRENGTH') continue
		const group = getMuscleGroup(entry)
		counts.set(group, (counts.get(group) ?? 0) + getWorkingSets([entry]).length)
	}
	return [...MUSCLE_GROUP_ORDER, null]
		.map((muscleGroup) => ({ muscleGroup, setCount: counts.get(muscleGroup) ?? 0 }))
		.filter((group) => group.setCount > 0)
}

const AVG_DECIMALS_FACTOR = 10

/**
 * Per week over the calendar Monday–Sunday weeks shown: from the week the period starts in (not
 * before the week of the very first workout) to the current one, inclusive.
 */
const getAvgPerWeek = ({
	count,
	range,
	today,
	firstWorkoutDate,
}: {
	count: number
	range: DateRange
	today: string
	firstWorkoutDate: string | null
}): number | null => {
	if (count === 0 || firstWorkoutDate === null) return null
	const periodStart = getWeekStart(range.from)
	const firstStart = getWeekStart(firstWorkoutDate)
	const start = periodStart > firstStart ? periodStart : firstStart
	const weeks = (toTime(getWeekStart(today)) - toTime(start)) / MS_IN_DAY / DAYS_IN_WEEK + 1
	if (weeks < 1) return null
	return Math.round((count / weeks) * AVG_DECIMALS_FACTOR) / AVG_DECIMALS_FACTOR
}

const getDurations = (
	workouts: readonly StatsWorkoutRow[],
): { named: number[]; hasEstimate: boolean } => {
	const durations = workouts.map((workout) => ({
		minutes: workout.durationMin ?? getEstimatedDurationMin(workout),
		isEstimate: workout.durationMin === null,
	}))
	const withDuration = durations.filter(
		(duration): duration is { minutes: number; isEstimate: boolean } => duration.minutes !== null,
	)
	return {
		named: withDuration.map((duration) => duration.minutes),
		hasEstimate: withDuration.some((duration) => duration.isEstimate),
	}
}

/** `workouts` and `entries` are the whole query window: an edge week counts in full, past the period. */
const getBuckets = (
	buckets: readonly StatsBucketRange[],
	workouts: readonly StatsWorkoutRow[],
	entries: readonly StatsEntryRow[],
): WorkoutStatsBucket[] =>
	buckets.map((bucket) => {
		const bucketEntries = entries.filter((entry) => isInRange(entry.workoutLocalDate, bucket))
		return {
			...bucket,
			workoutCount: workouts.filter((workout) => isInRange(workout.localDate, bucket)).length,
			setCount: countWorkingSets(bucketEntries),
			cardioMin: sum(
				bucketEntries
					.filter((entry) => entry.kind === 'CARDIO')
					.map((entry) => entry.durationMin ?? 0),
			),
		}
	})

const getCardio = (
	buckets: readonly WorkoutStatsBucket[],
	entries: readonly StatsEntryRow[],
): Cardio => {
	const cardio = entries.filter((entry) => entry.kind === 'CARDIO')
	// an entry without a dictionary id has no uuid to link to: it is in the totals, not in byExercise
	const byId = new Map<string, StatsEntryRow[]>()
	for (const entry of cardio) {
		if (entry.exerciseId !== null) {
			byId.set(entry.exerciseId, [...(byId.get(entry.exerciseId) ?? []), entry])
		}
	}
	const byExercise = [...byId].map(([exerciseId, grouped]) => {
		const distances = grouped.flatMap((entry) =>
			entry.distanceM === null ? [] : [entry.distanceM],
		)
		return {
			exerciseId,
			name: grouped.reduce((latest, entry) =>
				entry.workoutLocalDate >= latest.workoutLocalDate ? entry : latest,
			).name,
			sessionCount: new Set(grouped.map((entry) => entry.workoutId)).size,
			durationMin: sum(grouped.map((entry) => entry.durationMin ?? 0)),
			distanceM: distances.length === 0 ? null : sum(distances),
		}
	})
	return {
		sessionCount: new Set(cardio.map((entry) => entry.workoutId)).size,
		durationMin: sum(cardio.map((entry) => entry.durationMin ?? 0)),
		distanceM: sum(cardio.map((entry) => entry.distanceM ?? 0)),
		buckets: buckets.map(({ from, to, isFuture, cardioMin }) => ({
			from,
			to,
			isFuture,
			minutes: cardioMin,
		})),
		byExercise: byExercise.sort((a, b) => b.durationMin - a.durationMin),
	}
}

/**
 * The whole `GET /workouts/stats` answer. `workouts` and `entries` are live rows of the period and
 * of the previous one (only workouts are counted there); `allTimeStrengthEntries` are the strength
 * entries of every exercise listed in the period, over all time.
 */
export const buildWorkoutStats = ({
	period,
	today,
	firstWorkoutDate,
	workouts,
	entries,
	allTimeStrengthEntries,
	getBodyWeightKg = NO_BODY_WEIGHT,
}: {
	period: WorkoutStatsPeriod
	today: string
	/** The day of the user's very first workout, over all time; null without any. */
	firstWorkoutDate: string | null
	workouts: readonly StatsWorkoutRow[]
	entries: readonly StatsEntryRow[]
	allTimeStrengthEntries: readonly StatsEntryRow[]
	/** For the calorie estimate of the workouts that named none. */
	getBodyWeightKg?: BodyWeightOfDay
}): WorkoutStatsResponse => {
	const range = getStatsPeriodRange(period, today)
	const periodWorkouts = workouts.filter((workout) => isInRange(workout.localDate, range))
	const periodEntries = entries.filter((entry) => isInRange(entry.workoutLocalDate, range))
	const durations = getDurations(periodWorkouts)
	const buckets = getBuckets(range.buckets, workouts, entries)
	return {
		period,
		from: range.from,
		to: range.to,
		previous: range.previous,
		overview: {
			workoutCount: periodWorkouts.length,
			avgPerWeek: getAvgPerWeek({
				count: periodWorkouts.length,
				range,
				today,
				firstWorkoutDate,
			}),
			workoutCountPrev: workouts.filter((workout) => isInRange(workout.localDate, range.previous))
				.length,
			exerciseCount: countStrengthExercises(periodEntries),
			setCount: countWorkingSets(periodEntries),
			durationMin: sum(durations.named),
			durationWorkoutCount: durations.named.length,
			avgDurationMin:
				durations.named.length === 0
					? null
					: Math.round(sum(durations.named) / durations.named.length),
			hasEstimatedDuration: durations.hasEstimate,
			burned: getBurned({ workouts: periodWorkouts, entries: periodEntries, getBodyWeightKg }),
			buckets,
			groups: getGroups(periodEntries),
		},
		exercises: buildExerciseList(periodEntries, allTimeStrengthEntries),
		cardio: getCardio(buckets, periodEntries),
	}
}
