import type { LoggableMealType } from '@kus/shared'

import { getLocalDate, getLocalHour, getZonedMoment } from '../../common/time'

/** Local hour → meal when the user didn't name it: [from, to) in the user's timezone. */
const MEAL_HOURS: { type: LoggableMealType; from: number; to: number }[] = [
	{ type: 'BREAKFAST', from: 4, to: 11 },
	{ type: 'LUNCH', from: 11, to: 16 },
	{ type: 'DINNER', from: 16, to: 22 },
]

/** When a named meal other than the current one is usually eaten, local hour. */
export const TYPICAL_MEAL_HOUR: Record<LoggableMealType, number> = {
	BREAKFAST: 8,
	LUNCH: 13,
	SNACK: 16,
	DINNER: 19,
}

export const getMealTypeByHour = (hour: number): LoggableMealType =>
	MEAL_HOURS.find(({ from, to }) => hour >= from && hour < to)?.type ?? 'SNACK'

interface MealEatenAtParams {
	mealType: LoggableMealType
	/** The user named the meal ("на сніданок"), it wasn't picked by the clock. */
	isNamed: boolean
	now: Date
	timezone: string
}

/**
 * «на сніданок …» written at 13:00 happened in the morning: a named meal other than the one the
 * clock gives gets its typical time today. Never in the future — a meal not eaten yet stays at now.
 */
export const getMealEatenAt = ({ mealType, isNamed, now, timezone }: MealEatenAtParams): Date => {
	if (!isNamed) return now
	if (mealType === getMealTypeByHour(getLocalHour(now, timezone))) return now
	const typical = getZonedMoment(getLocalDate(now, timezone), TYPICAL_MEAL_HOUR[mealType], timezone)
	return typical < now ? typical : now
}
