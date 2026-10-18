// Days the model may name, shared by the context ("Days") and the parser. Pure ISO-date arithmetic
// in UTC, so the user's timezone never shifts a day.

/** Food can be logged this many days back from the user's today... */
export const ENTRY_BACKDATE_MAX_DAYS = 3
/** ...and this many days ahead (tomorrow's plan). */
export const ENTRY_AHEAD_MAX_DAYS = 1

const MS_IN_DAY = 24 * 60 * 60 * 1000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export type Weekday = (typeof WEEKDAYS)[number]

export type LoggableDayLabel = 'today' | 'yesterday' | 'tomorrow'

export interface LoggableDay {
	/** `YYYY-MM-DD` */
	localDate: string
	weekday: Weekday
	label: LoggableDayLabel | null
}

export const getDayNumber = (date: string): number =>
	Math.round(Date.parse(`${date}T00:00:00Z`) / MS_IN_DAY)

/** `YYYY-MM-DD` shifted by whole days. */
export const shiftDate = (date: string, days: number): string =>
	new Date((getDayNumber(date) + days) * MS_IN_DAY).toISOString().slice(0, 10)

/** Days from `today` to `date`: negative for the past, 1 for tomorrow. */
export const getDayOffset = (date: string, today: string): number =>
	getDayNumber(date) - getDayNumber(today)

export const getWeekday = (date: string): Weekday =>
	WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? 'Sun'

const LABELS: Partial<Record<number, LoggableDayLabel>> = {
	[-1]: 'yesterday',
	0: 'today',
	1: 'tomorrow',
}

/** The days food can be logged to, oldest first: today − 3 … today + 1. */
export const getLoggableDays = (today: string): LoggableDay[] =>
	Array.from({ length: ENTRY_BACKDATE_MAX_DAYS + ENTRY_AHEAD_MAX_DAYS + 1 }, (_, index) => {
		const offset = index - ENTRY_BACKDATE_MAX_DAYS
		const localDate = shiftDate(today, offset)
		return { localDate, weekday: getWeekday(localDate), label: LABELS[offset] ?? null }
	})
