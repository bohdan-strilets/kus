import type { DayStats } from './get-day-stats'

/** eaten / goal for the «Сьогодні» tab ring; 0 without a goal (an empty track, as on the gauge). */
export const getDayProgress = ({ eaten, goal }: Pick<DayStats, 'eaten' | 'goal'>): number =>
	goal !== null && goal > 0 ? eaten / goal : 0
