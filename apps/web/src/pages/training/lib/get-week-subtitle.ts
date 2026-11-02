import type { TFunction } from 'i18next'

import { formatWorkoutTotal } from '@/entities/workout'

import type { WeekSummary } from './get-week-summary'

/** «4 тренування · 3 год 24 хв»; «ще без тренувань» for an empty week. */
export const getWeekSubtitle = (
	summary: Pick<WeekSummary, 'count' | 'minutes'>,
	t: TFunction,
): string => {
	if (summary.count === 0) return t('training.journal.week.none')
	return [
		t('training.journal.week.count', { count: summary.count }),
		summary.minutes > 0 ? formatWorkoutTotal(summary.minutes, t) : null,
	]
		.filter((part): part is string => part !== null)
		.join(' · ')
}
