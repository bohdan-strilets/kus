import type { TFunction } from 'i18next'

import { formatWorkoutMinutes, type WorkoutCounts } from '@/entities/workout'

const SEPARATOR = ' · '

/**
 * The footer line of a card is one or two lines wide at 375 px (about 33 characters of 13px text
 * per line). Cardio joins the counts only while the whole line stays within this budget; beyond it
 * the counter keeps to the strength exercises, so cardio never pushes the row to a third line.
 */
export const FOOTER_CARDIO_MAX_CHARS = 32

export const formatStrengthCounts = (counts: WorkoutCounts, t: TFunction): string | null => {
	if (counts.exerciseCount === 0) return null
	return [
		t('workout.exerciseCount', { count: counts.exerciseCount }),
		t('workout.setCountFull', { count: counts.setCount }),
	].join(SEPARATOR)
}

export const formatCardioCounts = (counts: WorkoutCounts, t: TFunction): string | null => {
	if (!counts.hasCardio) return null
	if (counts.cardioMinutes === null) return t('workout.cardioBare')
	return t('workout.cardioPart', { duration: formatWorkoutMinutes(counts.cardioMinutes, t) })
}

/** «7 вправ · 20 підходів · кардіо 25 хв» — the header of the summary, everything told. */
export const formatSummaryCounts = (counts: WorkoutCounts, t: TFunction): string | null => {
	const parts = [formatStrengthCounts(counts, t), formatCardioCounts(counts, t)].filter(
		(part): part is string => part !== null,
	)
	return parts.length > 0 ? parts.join(SEPARATOR) : null
}

/**
 * The counter in the footer of an exercise card: strength counts, plus «кардіо 25 хв» when it is
 * the only thing there is or when the line with `prefixLength` characters before it still fits.
 */
export const formatFooterCounts = (
	counts: WorkoutCounts,
	t: TFunction,
	prefixLength: number,
): string | null => {
	const strength = formatStrengthCounts(counts, t)
	const cardio = formatCardioCounts(counts, t)
	if (strength === null) return cardio
	if (cardio === null) return strength
	const full = [strength, cardio].join(SEPARATOR)
	return prefixLength + full.length <= FOOTER_CARDIO_MAX_CHARS ? full : strength
}
