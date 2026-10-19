import { shiftLocalDate } from './local-date'

export type DayRelation = 'today' | 'tomorrow' | 'yesterday' | 'other'

/** How a `YYYY-MM-DD` day sits against today (both in the user's timezone): picks «Вчора» / «Завтра» / a weekday. */
export const getDayRelation = (localDate: string, today: string): DayRelation => {
	if (localDate === today) return 'today'
	if (localDate === shiftLocalDate(today, 1)) return 'tomorrow'
	if (localDate === shiftLocalDate(today, -1)) return 'yesterday'
	return 'other'
}
