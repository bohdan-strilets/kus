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
	isInRange,
	MS_IN_DAY,
	toTime,
} from './workout-stats-period'
import type { StatsEntryRow, StatsWorkoutRow } from './workout-stats.types'
import { getEstimatedDurationMin, getMuscleGroup } from './workouts.mapper'

type Overview = WorkoutStatsResponse['overview']
type Cardio = WorkoutStatsResponse['cardio']

/** Only kcal the person named or a device showed are counted — never an estimate. */
const NAMED_KCAL_SOURCES = ['MANUAL', 'DEVICE'] as const

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

/** Per week over the days gone so far (the rest of the period has not happened yet), never less than one week. */
const getAvgPerWeek = (count: number, range: DateRange, today: string): number | null => {
	if (count === 0) return null
	const end = today < range.to ? today : range.to
	const days = (toTime(end) - toTime(range.from)) / MS_IN_DAY + 1
	const weeks = Math.max(days / DAYS_IN_WEEK, 1)
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

const getKcal = (workouts: readonly StatsWorkoutRow[]): Overview['kcal'] => {
	const values = workouts.flatMap((workout) =>
		workout.kcalBurned !== null &&
		workout.kcalSource !== null &&
		(NAMED_KCAL_SOURCES as readonly string[]).includes(workout.kcalSource)
			? [workout.kcalBurned]
			: [],
	)
	return {
		total: values.length === 0 ? null : sum(values),
		workoutsWithKcal: values.length,
		workoutCount: workouts.length,
	}
}

const getBuckets = (
	buckets: readonly DateRange[],
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
		buckets: buckets.map(({ from, to, cardioMin }) => ({ from, to, minutes: cardioMin })),
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
	workouts,
	entries,
	allTimeStrengthEntries,
	getBodyWeightKg = NO_BODY_WEIGHT,
}: {
	period: WorkoutStatsPeriod
	today: string
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
	const buckets = getBuckets(range.buckets, periodWorkouts, periodEntries)
	return {
		period,
		from: range.from,
		to: range.to,
		previous: range.previous,
		overview: {
			workoutCount: periodWorkouts.length,
			avgPerWeek: getAvgPerWeek(periodWorkouts.length, range, today),
			workoutCountPrev: workouts.filter((workout) => isInRange(workout.localDate, range.previous))
				.length,
			exerciseCount: countStrengthExercises(periodEntries),
			setCount: countWorkingSets(periodEntries),
			durationMin: sum(durations.named),
			avgDurationMin:
				durations.named.length === 0
					? null
					: Math.round(sum(durations.named) / durations.named.length),
			hasEstimatedDuration: durations.hasEstimate,
			burned: getBurned({ workouts: periodWorkouts, entries: periodEntries, getBodyWeightKg }),
			kcal: getKcal(periodWorkouts),
			buckets,
			groups: getGroups(periodEntries),
		},
		exercises: buildExerciseList(periodEntries, allTimeStrengthEntries),
		cardio: getCardio(buckets, periodEntries),
	}
}
