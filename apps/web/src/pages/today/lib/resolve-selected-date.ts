import { ENTRY_AHEAD_MAX_DAYS } from '@kus/shared'

import { shiftLocalDate } from '@/shared/lib'

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/

/** The last day the screen opens: tomorrow (the plan is read here too). */
export const getLastViewableDate = (today: string): string =>
	shiftLocalDate(today, ENTRY_AHEAD_MAX_DAYS)

/** `?date=` of the screen: a real day up to tomorrow, else today (a typo or a day further ahead shows today). */
export const resolveSelectedDate = (param: string | null, today: string): string => {
	if (param === null || !LOCAL_DATE.test(param)) return today
	const parsed = new Date(`${param}T00:00:00Z`)
	// 2026-02-31 parses into March: only a date that reads back the same is real
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== param) return today
	return param > getLastViewableDate(today) ? today : param
}
