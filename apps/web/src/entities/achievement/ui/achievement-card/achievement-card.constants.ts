import type { AchievementResponse } from '@kus/shared'

/** The sentence of the card per achievement type (the streak has plural forms). */
export const ACHIEVEMENT_TEXT_KEY = {
	WEIGHT_KG_LOST: 'achievement.weightKgLost',
	FOOD_STREAK: 'achievement.foodStreak',
} as const satisfies Record<AchievementResponse['type'], string>

export const ACHIEVEMENT_COUNT_UP_MS = 600
export const ACHIEVEMENT_HAMSTER_SIZE = 56
