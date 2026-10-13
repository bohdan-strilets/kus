import type { AchievementResponse } from '@kus/shared'

/**
 * The one achievement a reply shows a card for: kilograms outrank the streak, and the streak then
 * stays silent (no card). Within one type the biggest value wins.
 */
export const pickAchievement = (
	achievements: readonly AchievementResponse[],
): AchievementResponse | null => {
	const best = (type: AchievementResponse['type']): AchievementResponse | null =>
		achievements
			.filter((achievement) => achievement.type === type)
			.reduce<AchievementResponse | null>(
				(top, achievement) => (top === null || achievement.value > top.value ? achievement : top),
				null,
			)
	return best('WEIGHT_KG_LOST') ?? best('FOOD_STREAK')
}
