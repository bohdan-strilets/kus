import type { DayInRange } from '@kus/shared'

import type { WeekDay } from '@/entities/stats'
import { shiftLocalDate, toCalendarDate } from '@/shared/lib'

export const WEEK_LENGTH = 7

/** The first day of the 7-day window that ends on `windowEnd`. */
export const getWeekStart = (windowEnd: string): string =>
	shiftLocalDate(windowEnd, 1 - WEEK_LENGTH)

/**
 * Seven days ending on `windowEnd`, each with the status the API gave it (none yet — empty). A day
 * after `today` with food is «planned»: the API has no such status, it is derived here.
 */
export const getWeekDays = (
	windowEnd: string,
	days: readonly DayInRange[],
	today: string,
): WeekDay[] => {
	const statusByDate = new Map(days.map((day) => [day.localDate, day.status]))
	return Array.from({ length: WEEK_LENGTH }, (_, index) => {
		const localDate = shiftLocalDate(getWeekStart(windowEnd), index)
		const status = statusByDate.get(localDate) ?? 'empty'
		const isUpcoming = localDate > today
		return {
			date: toCalendarDate(localDate),
			status: isUpcoming && status !== 'empty' ? 'planned' : status,
			isUpcoming,
		}
	})
}
