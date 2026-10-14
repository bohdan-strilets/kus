import type { FOOD_STREAK_MILESTONES } from '@kus/shared'
import type { ParseKeys } from 'i18next'

export const KILOGRAM_PHRASE_KEY: ParseKeys = 'achievement.phrase.weightKgLost'

/** The opening of the streak phrase per mark of the streak. */
export const STREAK_LEAD_KEY: Record<(typeof FOOD_STREAK_MILESTONES)[number], ParseKeys> = {
	3: 'achievement.phrase.streak.d3',
	7: 'achievement.phrase.streak.d7',
	14: 'achievement.phrase.streak.d14',
	30: 'achievement.phrase.streak.d30',
	60: 'achievement.phrase.streak.d60',
	100: 'achievement.phrase.streak.d100',
}

export const STREAK_NEXT_KEY: ParseKeys = 'achievement.phrase.streak.next'
