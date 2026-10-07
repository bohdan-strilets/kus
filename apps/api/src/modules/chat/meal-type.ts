import type { LoggableMealType } from '@kus/shared'

/** Local hour → meal when the user didn't name it: [from, to) in the user's timezone. */
const MEAL_HOURS: { type: LoggableMealType; from: number; to: number }[] = [
	{ type: 'BREAKFAST', from: 4, to: 11 },
	{ type: 'LUNCH', from: 11, to: 16 },
	{ type: 'DINNER', from: 16, to: 22 },
]

export const getMealTypeByHour = (hour: number): LoggableMealType =>
	MEAL_HOURS.find(({ from, to }) => hour >= from && hour < to)?.type ?? 'SNACK'
