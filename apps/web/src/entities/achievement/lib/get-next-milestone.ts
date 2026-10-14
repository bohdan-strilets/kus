import { FOOD_STREAK_MILESTONES } from '@kus/shared'

/** The next streak mark above `days`, or null after the last one. */
export const getNextStreakMilestone = (days: number): number | null =>
	FOOD_STREAK_MILESTONES.find((milestone) => milestone > days) ?? null
