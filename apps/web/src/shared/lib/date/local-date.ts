// The user's day is their calendar day in AuthUser.timezone — the same day the API sums.

const MS_IN_DAY = 24 * 60 * 60 * 1000
/** Noon keeps a date-only value on the same calendar day in any browser timezone. */
const NOON_HOUR = 12

const getParts = (date: Date, timeZone: string): Record<string, string> => {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		hourCycle: 'h23',
	}).formatToParts(date)
	return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

/** `YYYY-MM-DD` of the calendar day in that timezone. */
export const getLocalDateString = (date: Date, timeZone: string): string => {
	const { year = '', month = '', day = '' } = getParts(date, timeZone)
	return `${year}-${month}-${day}`
}

export const getLocalHour = (date: Date, timeZone: string): number =>
	Number(getParts(date, timeZone).hour)

/** `2026-10-07`, −1 → `2026-10-06`; plain calendar arithmetic, no timezone involved. */
export const shiftLocalDate = (localDate: string, days: number): string => {
	const moment = Date.parse(`${localDate}T00:00:00Z`) + days * MS_IN_DAY
	return new Date(moment).toISOString().slice(0, 10)
}

/** A `YYYY-MM-DD` day as a Date for the date formatters (formatDayHeading, formatWeekdayShort). */
export const toCalendarDate = (localDate: string): Date => {
	const [year = 0, month = 1, day = 1] = localDate.split('-').map(Number)
	return new Date(year, month - 1, day, NOON_HOUR)
}

/** Back from a calendar Date (the week strip) to its `YYYY-MM-DD`. */
export const fromCalendarDate = (date: Date): string => {
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${date.getFullYear()}-${month}-${day}`
}
