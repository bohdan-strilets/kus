import type { WorkoutStatsPeriod } from '@kus/shared'

export type DateRange = { from: string; to: string }

export type StatsPeriodRange = DateRange & {
	previous: DateRange
	/** Days for a week, Monday–Sunday weeks clipped to the period otherwise. */
	buckets: DateRange[]
}

const MS_IN_DAY = 24 * 60 * 60 * 1000
const DAYS_IN_WEEK = 7
const QUARTER_MONTHS = 3
const MONTHS_BACK_QUARTER_START = 2

// local dates are calendar days: all arithmetic is in UTC, so there are no DST or timezone jumps
const toTime = (date: string): number => Date.parse(`${date}T00:00:00Z`)

const toDateString = (time: number): string => new Date(time).toISOString().slice(0, 10)

export const addDays = (date: string, days: number): string =>
	toDateString(toTime(date) + days * MS_IN_DAY)

const getDaysInMonth = (year: number, monthIndex: number): number =>
	new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

const parseParts = (date: string): { year: number; monthIndex: number; day: number } => {
	const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
	return { year, monthIndex: month - 1, day }
}

/** The same day of the month `months` away; 31 Mar − 1 month is 28/29 Feb. */
export const addMonthsClamped = (date: string, months: number): string => {
	const { year, monthIndex, day } = parseParts(date)
	const target = new Date(Date.UTC(year, monthIndex + months, 1))
	const targetYear = target.getUTCFullYear()
	const targetMonth = target.getUTCMonth()
	const clampedDay = Math.min(day, getDaysInMonth(targetYear, targetMonth))
	return toDateString(Date.UTC(targetYear, targetMonth, clampedDay))
}

const getMonthStart = (date: string, monthsBack = 0): string =>
	addMonthsClamped(`${date.slice(0, 7)}-01`, -monthsBack)

const getMonthEnd = (date: string): string => {
	const { year, monthIndex } = parseParts(date)
	return toDateString(Date.UTC(year, monthIndex, getDaysInMonth(year, monthIndex)))
}

export const getWeekStart = (date: string): string => {
	const daysSinceMonday = (new Date(toTime(date)).getUTCDay() + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK
	return addDays(date, -daysSinceMonday)
}

export const isInRange = (date: string, range: DateRange): boolean =>
	date >= range.from && date <= range.to

const getDayBuckets = ({ from, to }: DateRange): DateRange[] => {
	const buckets: DateRange[] = []
	for (let day = from; day <= to; day = addDays(day, 1)) buckets.push({ from: day, to: day })
	return buckets
}

const getWeekBuckets = ({ from, to }: DateRange): DateRange[] => {
	const buckets: DateRange[] = []
	for (let start = getWeekStart(from); start <= to; start = addDays(start, DAYS_IN_WEEK)) {
		const end = addDays(start, DAYS_IN_WEEK - 1)
		buckets.push({ from: start < from ? from : start, to: end > to ? to : end })
	}
	return buckets
}

/**
 * Calendar period around `today` (the user's local date), the previous one shifted to the same
 * point (Mon–Wed against the previous Mon–Wed), and the chart buckets. `to` is the end of the
 * period, which may be after today.
 */
export const getStatsPeriodRange = (
	period: WorkoutStatsPeriod,
	today: string,
): StatsPeriodRange => {
	if (period === 'week') {
		const from = getWeekStart(today)
		const range = { from, to: addDays(from, DAYS_IN_WEEK - 1) }
		return {
			...range,
			previous: { from: addDays(from, -DAYS_IN_WEEK), to: addDays(today, -DAYS_IN_WEEK) },
			buckets: getDayBuckets(range),
		}
	}
	const monthsInPeriod = period === 'month' ? 1 : QUARTER_MONTHS
	const range = {
		from: getMonthStart(today, period === 'month' ? 0 : MONTHS_BACK_QUARTER_START),
		to: getMonthEnd(today),
	}
	return {
		...range,
		previous: {
			from: addMonthsClamped(range.from, -monthsInPeriod),
			to: addMonthsClamped(today, -monthsInPeriod),
		},
		buckets: getWeekBuckets(range),
	}
}
