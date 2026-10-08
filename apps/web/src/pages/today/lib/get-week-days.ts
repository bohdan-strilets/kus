import type { DayInRange } from '@kus/shared'

import type { WeekDay } from '@/entities/stats'
import { shiftLocalDate, toCalendarDate } from '@/shared/lib'

export const WEEK_LENGTH = 7

/** The first day of the 7-day window that ends on `windowEnd`. */
export const getWeekStart = (windowEnd: string): string =>
	shiftLocalDate(windowEnd, 1 - WEEK_LENGTH)

/** Seven days ending on `windowEnd`, each with the status the API gave it (none yet — empty). */
export const getWeekDays = (windowEnd: string, days: readonly DayInRange[]): WeekDay[] => {
	const statusByDate = new Map(days.map((day) => [day.localDate, day.status]))
	return Array.from({ length: WEEK_LENGTH }, (_, index) => {
		const localDate = shiftLocalDate(getWeekStart(windowEnd), index)
		return { date: toCalendarDate(localDate), status: statusByDate.get(localDate) ?? 'empty' }
	})
}
