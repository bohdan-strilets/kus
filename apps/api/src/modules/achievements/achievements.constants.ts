import { FOOD_STREAK_MILESTONES } from '@kus/shared'

/** The streak is read over this many days — the last milestone, so nothing past it is ever needed. */
export const FOOD_STREAK_WINDOW_DAYS = Math.max(...FOOD_STREAK_MILESTONES)

/** Weights are stored with one decimal; kg lost is counted in these tenths to stay exact. */
export const TENTHS_PER_KG = 10
