// The user's "day" is their calendar day in User.timezone (docs/database.md), never the UTC date.

const MS_IN_DAY = 24 * 60 * 60 * 1000

const getParts = (date: Date, timezone: string): Record<string, string> => {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		weekday: 'long',
		hourCycle: 'h23',
	}).formatToParts(date)
	return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

/** `YYYY-MM-DD` of the user's calendar day. */
export const getLocalDateString = (date: Date, timezone: string): string => {
	const { year = '', month = '', day = '' } = getParts(date, timezone)
	return `${year}-${month}-${day}`
}

/** The user's calendar day as a UTC-midnight Date, which is how Prisma reads and writes @db.Date. */
export const getLocalDate = (date: Date, timezone: string): Date =>
	new Date(`${getLocalDateString(date, timezone)}T00:00:00Z`)

export const getLocalHour = (date: Date, timezone: string): number =>
	Number(getParts(date, timezone).hour)

/** `2026-10-07 13:20, Wednesday` — the clock the model reasons about ("на сніданок", "вчора"). */
export const formatLocalTime = (date: Date, timezone: string): string => {
	const { hour = '', minute = '', weekday = '' } = getParts(date, timezone)
	return `${getLocalDateString(date, timezone)} ${hour}:${minute}, ${weekday}`
}

/** `YYYY-MM-DD` of a @db.Date value read from Prisma. */
export const formatDbDate = (date: Date): string => date.toISOString().slice(0, 10)

export const addDays = (date: Date, days: number): Date =>
	new Date(date.getTime() + days * MS_IN_DAY)
