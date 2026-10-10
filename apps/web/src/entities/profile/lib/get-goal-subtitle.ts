import type { GoalType } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatDayMonth, INTL_LOCALE } from '@/shared/lib'

import { GOAL_TYPE_LABEL_KEY } from './profile-labels'

export interface GoalSubtitleInput {
	goalType: GoalType | null
	/** ISO datetime the account was created. */
	createdAt: string
}

/** «Ціль: схуднути · з 5 вересня» */
export const getGoalSubtitle = (
	{ goalType, createdAt }: GoalSubtitleInput,
	t: TFunction,
): string => {
	const date = formatDayMonth(new Date(createdAt))
	if (goalType === null) return t('profile.goalSubtitleNoGoal', { date })
	const goal = t(GOAL_TYPE_LABEL_KEY[goalType]).toLocaleLowerCase(INTL_LOCALE)
	return t('profile.goalSubtitle', { goal, date })
}
