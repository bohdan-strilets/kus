// What the parser rejects in the dates of log_food, show_day, close_day and show_stats. Shared, so the backend and the eval
// judge the same way; the model gets the text on the retry and answers with reply instead.
import { ENTRY_AHEAD_MAX_DAYS, ENTRY_BACKDATE_MAX_DAYS, getDayOffset, shiftDate } from './dates.js'
import type { LogFoodInput } from './tools.js'

const getFoodDateError = (path: string, date: string, today: string): string[] => {
	const offset = getDayOffset(date, today)
	if (offset >= -ENTRY_BACKDATE_MAX_DAYS && offset <= ENTRY_AHEAD_MAX_DAYS) return []
	const first = shiftDate(today, -ENTRY_BACKDATE_MAX_DAYS)
	const last = shiftDate(today, ENTRY_AHEAD_MAX_DAYS)
	const direction =
		offset < 0
			? `is more than ${ENTRY_BACKDATE_MAX_DAYS} days back`
			: `is more than ${ENTRY_AHEAD_MAX_DAYS} day ahead`
	return [
		`log_food: ${path} ${date} ${direction} — outside the days you can log to (${first}…${last}); do not log; tell the user with reply`,
	]
}

/** The call's own date and the date of each item must lie within the loggable days. */
export const getFoodDateErrors = (log: LogFoodInput, today: string): string[] => [
	...(log.date === null ? [] : getFoodDateError('date', log.date, today)),
	...log.items.flatMap((item, index) =>
		item.date === null ? [] : getFoodDateError(`items.${index}.date`, item.date, today),
	),
]

/** Any earlier day can be shown, and tomorrow; nothing is logged beyond that. */
export const getShowDayErrors = (date: string | null, today: string): string[] => {
	if (date === null || getDayOffset(date, today) <= ENTRY_AHEAD_MAX_DAYS) return []
	return [
		`show_day: date ${date} is later than tomorrow (${shiftDate(today, ENTRY_AHEAD_MAX_DAYS)}) — do not show; tell the user with reply that only days up to tomorrow can be shown`,
	]
}

/** Today or one of the last loggable days; closing a day is about a day that has happened. */
export const getCloseDayErrors = (date: string | null, today: string): string[] => {
	if (date === null) return []
	const offset = getDayOffset(date, today)
	if (offset >= -ENTRY_BACKDATE_MAX_DAYS && offset <= 0) return []
	const first = shiftDate(today, -ENTRY_BACKDATE_MAX_DAYS)
	return [
		`close_day: date ${date} is outside ${first}…${today} — do not close; tell the user with reply that only today and the last ${ENTRY_BACKDATE_MAX_DAYS} days can be closed`,
	]
}

/** A period may end today (the day so far counts), never in the future. */
export const getShowStatsErrors = (endDate: string | null, today: string): string[] => {
	if (endDate === null || getDayOffset(endDate, today) <= 0) return []
	return [`show_stats: endDate ${endDate} is in the future — use null or a day up to ${today}`]
}
