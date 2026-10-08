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

const MS_IN_MINUTE = 60 * 1000

/** How far the timezone's wall clock is ahead of UTC at this moment, in ms. */
const getOffsetMs = (date: Date, timezone: string): number => {
	const { year, month, day, hour, minute } = getParts(date, timezone)
	const wallClock = Date.UTC(
		Number(year),
		Number(month) - 1,
		Number(day),
		Number(hour),
		Number(minute),
	)
	return wallClock - Math.floor(date.getTime() / MS_IN_MINUTE) * MS_IN_MINUTE
}

/**
 * The moment the user's wall clock shows `hour`:00 on `localDate` (a @db.Date value). The offset is
 * read twice so a DST switch between the guess and the answer still lands on the right hour.
 */
export const getZonedMoment = (localDate: Date, hour: number, timezone: string): Date => {
	const guess = Date.UTC(
		localDate.getUTCFullYear(),
		localDate.getUTCMonth(),
		localDate.getUTCDate(),
		hour,
	)
	const first = guess - getOffsetMs(new Date(guess), timezone)
	return new Date(guess - getOffsetMs(new Date(first), timezone))
}

/** `YYYY-MM-DD` of a @db.Date value read from Prisma. */
export const formatDbDate = (date: Date): string => date.toISOString().slice(0, 10)

export const addDays = (date: Date, days: number): Date =>
	new Date(date.getTime() + days * MS_IN_DAY)
