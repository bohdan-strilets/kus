import type { TFunction } from 'i18next'

import { formatInteger } from '@/shared/lib'

import type { SessionSection } from './session-view'

/**
 * The grey line of a section header: «2 вправи · 6 підх.» for strength (no sets — only the count),
 * «25 хв» for cardio (exercises and sets are strength words); null when there is nothing to say.
 */
export const formatSectionSummary = (section: SessionSection, t: TFunction): string | null => {
	if (section.key === 'CARDIO') {
		return section.cardioMinutes === null
			? null
			: t('workout.min', { value: formatInteger(section.cardioMinutes) })
	}
	const exercises = t('workout.exerciseCount', { count: section.exercises.length })
	if (section.setCount === 0) return exercises
	return [exercises, t('workout.setCount', { count: section.setCount })].join(' · ')
}
