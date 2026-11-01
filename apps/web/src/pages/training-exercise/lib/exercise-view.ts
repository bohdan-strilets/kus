import type { ExerciseStatsResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { DETAIL_SEPARATOR, formatBestSet, formatNumber } from '@/entities/workout'
import { formatDayMonth, formatDayMonthShort, toCalendarDate } from '@/shared/lib'

import { type ExerciseMetric } from './training-exercise.constants'

type Point = ExerciseStatsResponse['points'][number]

export interface ExerciseSeries {
	/** Oldest first; a workout without the metric is skipped. */
	values: number[]
	firstDate: string | null
	lastDate: string | null
}

/** The points of the chart for a metric: top weight, or the reps at the top weight. */
export const getExerciseSeries = (
	points: readonly Point[],
	metric: ExerciseMetric,
): ExerciseSeries => {
	const used = points.flatMap((point) => {
		const value = metric === 'weight' ? point.topWeightKg : point.maxReps
		return value === null ? [] : [{ value, localDate: point.localDate }]
	})
	return {
		values: used.map((item) => item.value),
		firstDate: used[0]?.localDate ?? null,
		lastDate: used[used.length - 1]?.localDate ?? null,
	}
}

/** «Груди · 12 тренувань з 1 жовтня»; a bodyweight exercise says so after the group. */
export const formatExerciseSubtitle = (data: ExerciseStatsResponse, t: TFunction): string => {
	const { exercise } = data
	const group =
		exercise.muscleGroup === null
			? t('training.stats.overview.groups.other')
			: t(`muscle.${exercise.muscleGroup}`)
	const workouts = t('training.stats.exercise.subtitle', {
		workouts: t('training.journal.week.count', { count: data.points.length }),
		from: formatDayMonth(toCalendarDate(data.from)),
	})
	return [group, exercise.isBodyweight ? t('workout.bodyweight') : null, workouts]
		.filter((part) => part !== null)
		.join(DETAIL_SEPARATOR)
}

export interface RecordTile {
	key: string
	label: string
	value: string
	/** «26 жовт» */
	date: string
	/** The all-time best set: the tile gets a trophy. */
	isRecord: boolean
}

const toTile = (
	key: string,
	label: string,
	value: string | null,
	localDate: string | undefined,
	isRecord: boolean,
): RecordTile[] =>
	value === null || localDate === undefined
		? []
		: [{ key, label, value, date: formatDayMonthShort(toCalendarDate(localDate)), isRecord }]

/**
 * The all-time bests. Weighted: the heaviest set and the most reps at that weight («70×6»);
 * bodyweight: the most reps in a set and the most reps in one workout.
 */
export const getRecordTiles = (
	best: ExerciseStatsResponse['best'],
	isBodyweight: boolean,
	t: TFunction,
): RecordTile[] => {
	if (isBodyweight) {
		const mostReps = best.maxReps ?? best.topSet
		const session = best.maxSessionReps
		return [
			...toTile(
				'mostReps',
				t('training.stats.exercise.tiles.mostRepsBodyweight'),
				formatBestSet(mostReps, t),
				mostReps?.localDate,
				true,
			),
			...toTile(
				'perSession',
				t('training.stats.exercise.tiles.perSession'),
				session === null ? null : t('workout.reps', { value: formatNumber(session.reps) }),
				session?.localDate,
				false,
			),
		]
	}
	return [
		...toTile(
			'heaviest',
			t('training.stats.exercise.tiles.heaviest'),
			formatBestSet(best.topSet, t),
			best.topSet?.localDate,
			true,
		),
		...toTile(
			'mostReps',
			t('training.stats.exercise.tiles.mostReps'),
			formatBestSet(best.maxReps, t),
			best.maxReps?.localDate,
			false,
		),
	]
}
