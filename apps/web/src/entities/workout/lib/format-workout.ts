import type { WorkoutExerciseResponse, WorkoutResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatDecimal, formatInteger } from '@/shared/lib'
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
export const formatWorkoutDistance = (meters: number, t: TFunction): string =>
	t('workout.km', { value: formatDecimal(meters / METERS_IN_KM, 1) })

/** «20 хв · 3,0 км»; the distance only when it was said. */
export const formatCardioSummary = (
	exercise: Pick<WorkoutExerciseResponse, 'durationMin' | 'distanceM'>,
	t: TFunction,
): string | null => {
	const parts = [
		exercise.durationMin === null ? null : formatWorkoutMinutes(exercise.durationMin, t),
		exercise.distanceM === null ? null : formatWorkoutDistance(exercise.distanceM, t),
	].filter((part): part is string => part !== null)
	return parts.length > 0 ? parts.join(SEPARATOR) : null
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
