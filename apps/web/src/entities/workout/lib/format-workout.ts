import type { WorkoutExerciseResponse, WorkoutResponse, WorkoutSetResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatDecimal, formatInteger, INTL_LOCALE } from '@/shared/lib'
import type { IconName } from '@/shared/ui'

import {
	CARDIO_ICON_RULES,
	FALLBACK_CARDIO_ICON,
	METERS_IN_KM,
	STRENGTH_ICON,
} from './workout.constants'

const SEPARATOR = ' · '

/** «80», «77,5» — a decimal only when there is one. */
export const formatNumber = (value: number): string =>
	Number.isInteger(value) ? formatInteger(value) : formatDecimal(value, 1)

const formatWeight = (weightKg: number, t: TFunction): string =>
	t('workout.kg', { value: formatNumber(weightKg) })

/** «20 хв». */
export const formatWorkoutMinutes = (minutes: number, t: TFunction): string =>
	t('workout.min', { value: formatInteger(minutes) })

const MINUTES_IN_HOUR = 60

/** A total of minutes for the week line: «55 хв», «2 год», «2 год 35 хв». */
export const formatWorkoutTotal = (minutes: number, t: TFunction): string => {
	if (minutes < MINUTES_IN_HOUR) return formatWorkoutMinutes(minutes, t)
	const hours = formatInteger(Math.floor(minutes / MINUTES_IN_HOUR))
	const rest = minutes % MINUTES_IN_HOUR
	return rest === 0
		? t('workout.hours', { value: hours })
		: t('workout.hourMin', { hours, minutes: formatInteger(rest) })
}

/** «3,0 км». */
const formatDistance = (meters: number, t: TFunction): string =>
	t('workout.km', { value: formatDecimal(meters / METERS_IN_KM, 1) })

const formatTimedSet = (set: WorkoutSetResponse, t: TFunction): string | null =>
	set.durationSec === null ? null : t('workout.sec', { value: formatInteger(set.durationSec) })

const formatDifferentWeights = (
	sets: readonly WorkoutSetResponse[],
	counts: readonly number[],
	t: TFunction,
): string =>
	sets
		.map((set, index) =>
			set.weightKg === null
				? formatInteger(counts[index] ?? 0)
				: t('workout.weightTimes', {
						weight: formatWeight(set.weightKg, t),
						reps: formatInteger(counts[index] ?? 0),
					}),
		)
		.join(', ')

/**
 * The line under a strength exercise: «80 кг · 3×8» for equal sets, «80 кг × 8, 8, 6» for one
 * weight with different reps, «80 кг × 8, 85 кг × 6» for different weights, «3×15» without weight.
 * Warm-up sets stay out of it. null when nothing is worth a line.
 */
export const formatSetsSummary = (
	sets: readonly WorkoutSetResponse[],
	t: TFunction,
): string | null => {
	const working = sets.filter((set) => !set.isWarmup)
	const first = working[0]
	if (!first) return null
	const counts = working.map((set) => set.reps)
	// a plank or a hold: reps are absent, the time is the result
	if (counts.some((value) => value === null)) {
		return working.map((set) => formatTimedSet(set, t)).find((text) => text !== null) ?? null
	}
	const reps = counts.filter((value): value is number => value !== null)
	if (!working.every((set) => set.weightKg === first.weightKg)) {
		return formatDifferentWeights(working, reps, t)
	}
	if (reps.every((value) => value === reps[0])) {
		const scheme = t('workout.scheme', {
			sets: formatInteger(working.length),
			reps: formatInteger(reps[0] ?? 0),
		})
		return first.weightKg === null
			? scheme
			: [formatWeight(first.weightKg, t), scheme].join(SEPARATOR)
	}
	const list = reps.map((value) => formatInteger(value)).join(', ')
	return first.weightKg === null
		? list
		: t('workout.weightTimes', { weight: formatWeight(first.weightKg, t), reps: list })
}

/** «20 хв · 3,0 км»; the distance only when it was said. */
export const formatCardioSummary = (
	exercise: Pick<WorkoutExerciseResponse, 'durationMin' | 'distanceM'>,
	t: TFunction,
): string | null => {
	const parts = [
		exercise.durationMin === null ? null : formatWorkoutMinutes(exercise.durationMin, t),
		exercise.distanceM === null ? null : formatDistance(exercise.distanceM, t),
	].filter((part): part is string => part !== null)
	return parts.length > 0 ? parts.join(SEPARATOR) : null
}

/** The grey line of an exercise row; null when the user said nothing but the name. */
export const formatExerciseSummary = (
	exercise: WorkoutExerciseResponse,
	t: TFunction,
): string | null => {
	if (exercise.kind === 'CARDIO') return formatCardioSummary(exercise, t)
	return formatSetsSummary(exercise.sets, t) ?? formatCardioSummary(exercise, t)
}

/** run for a run or a treadmill, bike, rowing, otherwise cardio; strength and the rest — training. */
export const getExerciseIcon = (
	exercise: Pick<WorkoutExerciseResponse, 'kind' | 'name'>,
): IconName => {
	if (exercise.kind !== 'CARDIO') return STRENGTH_ICON
	return (
		CARDIO_ICON_RULES.find((rule) => rule.pattern.test(exercise.name))?.icon ?? FALLBACK_CARDIO_ICON
	)
}

/** «Зал», «Вдома», «Біг» (outdoors) or «Тренування». */
export const formatWorkoutKind = (place: WorkoutResponse['place'], t: TFunction): string =>
	t(`workout.place.${place ?? 'OTHER'}`)

/**
 * «320 ккал · з табло · на ціль не впливає» — only a number the user said or a device showed.
 * A number from a model estimate is never shown, and without a number there is no line.
 */
export const formatWorkoutKcalNote = (
	workout: Pick<WorkoutResponse, 'kcalBurned' | 'kcalSource'>,
	t: TFunction,
): string | null => {
	if (workout.kcalBurned === null) return null
	if (workout.kcalSource !== 'MANUAL' && workout.kcalSource !== 'DEVICE') return null
	return t('workout.kcalNote', {
		kcal: formatInteger(workout.kcalBurned),
		source: t(`workout.kcalSource.${workout.kcalSource}`),
	})
}

/** The names of the exercises in the row of «Сьогодні»: «жим, присід, тяга». */
export const formatExerciseNames = (workout: Pick<WorkoutResponse, 'exercises'>): string =>
	workout.exercises.map((exercise) => exercise.name.toLocaleLowerCase(INTL_LOCALE)).join(', ')
