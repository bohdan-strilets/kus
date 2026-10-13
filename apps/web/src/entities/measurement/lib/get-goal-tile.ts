import type { MeasurementCard } from '@kus/shared'

export type GoalTile = { kind: 'reached' } | { kind: 'left'; kg: number }

/** «До цілі»: «Ціль досягнута» instead of «0 кг»; nothing without a goal direction (waist, MAINTAIN). */
export const getGoalTile = ({
	isGoalReached,
	toGoal,
}: Pick<MeasurementCard, 'isGoalReached' | 'toGoal'>): GoalTile | null => {
	if (isGoalReached === true) return { kind: 'reached' }
	if (toGoal === null) return null
	return { kind: 'left', kg: toGoal }
}
