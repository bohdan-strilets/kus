import { type DayContext, getDayOffset, getLoggableDays } from '@kus/shared'

import { roundNutrition } from '../entries/entries.mapper'

/**
 * The days the model can log to (today − 3 … today + 1) with what the backend counted for each.
 * `overKcal` is only for past days: the model never subtracts the goal itself.
 */
export const buildDaysContext = ({
	today,
	totalsByDay,
	goalKcalByDay,
}: {
	today: string
	totalsByDay: ReadonlyMap<string, { kcal: number; entryCount: number }>
	goalKcalByDay: ReadonlyMap<string, number | null>
}): DayContext[] =>
	getLoggableDays(today).map(({ localDate, label }) => {
		const { kcal, entryCount } = totalsByDay.get(localDate) ?? { kcal: 0, entryCount: 0 }
		const goalKcal = goalKcalByDay.get(localDate) ?? null
		const isPast = getDayOffset(localDate, today) < 0
		const isOver = isPast && goalKcal !== null && kcal > goalKcal
		return {
			localDate,
			label,
			kcal,
			overKcal: isOver ? roundNutrition(kcal - goalKcal) : null,
			entryCount,
		}
	})
