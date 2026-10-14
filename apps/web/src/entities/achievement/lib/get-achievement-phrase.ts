import type { AchievementResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import {
	KILOGRAM_PHRASE_KEY,
	STREAK_LEAD_KEY,
	STREAK_NEXT_KEY,
} from './achievement-phrase.constants'
import { getNextStreakMilestone } from './get-next-milestone'

/** The warm line under the number: a kilogram note, or the streak mark with the next one. */
export const getAchievementPhrase = (achievement: AchievementResponse, t: TFunction): string => {
	if (achievement.type === 'WEIGHT_KG_LOST') return t(KILOGRAM_PHRASE_KEY)

	const leadKey = (STREAK_LEAD_KEY as Partial<Record<number, typeof KILOGRAM_PHRASE_KEY>>)[
		achievement.value
	]
	const next = getNextStreakMilestone(achievement.value)
	return [leadKey ? t(leadKey) : null, next === null ? null : t(STREAK_NEXT_KEY, { count: next })]
		.filter((part): part is string => part !== null)
		.join(' ')
}
