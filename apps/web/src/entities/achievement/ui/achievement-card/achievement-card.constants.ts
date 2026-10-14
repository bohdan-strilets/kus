import type { AchievementResponse } from '@kus/shared'
import type { ParseKeys } from 'i18next'

/** The sentence read by a screen reader per achievement type (the streak has plural forms). */
export const ACHIEVEMENT_TEXT_KEY = {
	WEIGHT_KG_LOST: 'achievement.weightKgLost',
	FOOD_STREAK: 'achievement.foodStreak',
} as const satisfies Record<AchievementResponse['type'], string>

/** The small label above the number. */
export const ACHIEVEMENT_EYEBROW_KEY = {
	WEIGHT_KG_LOST: 'achievement.eyebrow.weightKgLost',
	FOOD_STREAK: 'achievement.eyebrow.foodStreak',
} as const satisfies Record<AchievementResponse['type'], string>

/** The counting part: «−2» / «7». */
export const ACHIEVEMENT_NUMBER_KEY = {
	WEIGHT_KG_LOST: 'achievement.number.weightKgLost',
	FOOD_STREAK: 'achievement.number.foodStreak',
} as const satisfies Record<AchievementResponse['type'], string>

/** The static unit next to the number: «кг від старту» / «днів поспіль». */
export const ACHIEVEMENT_UNIT_KEY = {
	WEIGHT_KG_LOST: 'achievement.unit.weightKgLost',
	FOOD_STREAK: 'achievement.unit.foodStreak',
} as const satisfies Record<AchievementResponse['type'], string>

/** The line under the unit; the kilogram card has none until the backend sends the weight pair. */
export const ACHIEVEMENT_CAPTION_KEY: Partial<Record<AchievementResponse['type'], ParseKeys>> = {
	FOOD_STREAK: 'achievement.caption.foodStreak',
}

export const ACHIEVEMENT_COUNT_UP_MS = 600
export const ACHIEVEMENT_HAMSTER_SIZE = 84
