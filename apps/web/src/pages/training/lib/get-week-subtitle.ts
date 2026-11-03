import type { TFunction } from 'i18next'

import { formatWorkoutTotal } from '@/entities/workout'

import type { ProgramWeekProgress } from './get-program-progress'
import type { WeekSummary } from './get-week-summary'

/**
 * «1 з 3 за програмою» when the program has a weekly plan (mockups/training-home.html); otherwise
 * «4 тренування · 3 год 24 хв», or «ще без тренувань» for an empty week.
 */
export const getWeekSubtitle = (
	summary: Pick<WeekSummary, 'count' | 'minutes'>,
	t: TFunction,
	programProgress: ProgramWeekProgress | null = null,
): string => {
	if (programProgress) {
		return t('training.journal.week.programProgress', {
			done: programProgress.done,
			total: programProgress.total,
		})
	}
	if (summary.count === 0) return t('training.journal.week.none')
	return [
		t('training.journal.week.count', { count: summary.count }),
		summary.minutes > 0 ? formatWorkoutTotal(summary.minutes, t) : null,
	]
		.filter((part): part is string => part !== null)
		.join(' · ')
}
