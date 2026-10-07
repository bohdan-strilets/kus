import type { LoggableMealType, MealType } from '@kus/shared'

/** The day's course, not insertion order: chat cards and the model's day context follow it. */
export const MEAL_TYPE_ORDER: readonly LoggableMealType[] = [
	'BREAKFAST',
	'LUNCH',
	'SNACK',
	'DINNER',
]

/** OTHER (never logged by the chat) goes last. */
export const getMealRank = (type: MealType): number => {
	const rank = MEAL_TYPE_ORDER.findIndex((mealType) => mealType === type)
	return rank === -1 ? MEAL_TYPE_ORDER.length : rank
}
