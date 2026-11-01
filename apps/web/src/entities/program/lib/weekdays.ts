import { WEEKDAY_ISO_MAX, WEEKDAY_ISO_MIN } from '@kus/shared'

import { formatWeekdayLong, formatWeekdayShort } from '@/shared/lib'

/** 2024-01-01 is a Monday: ISO weekday n is the n-th of January. */
const WEEKDAY_BASE_YEAR = 2024

/** Пн … Нд: the ISO weekdays 1…7 in the order of the week. */
export const PROGRAM_WEEKDAYS: readonly number[] = Array.from(
	{ length: WEEKDAY_ISO_MAX - WEEKDAY_ISO_MIN + 1 },
	(_, index) => WEEKDAY_ISO_MIN + index,
)

const toDate = (isoWeekday: number): Date => new Date(WEEKDAY_BASE_YEAR, 0, isoWeekday)

/** «Пн» */
export const getWeekdayShortName = (isoWeekday: number): string =>
	formatWeekdayShort(toDate(isoWeekday))

/** «Понеділок» */
export const getWeekdayLongName = (isoWeekday: number): string =>
	formatWeekdayLong(toDate(isoWeekday))

/** The day added or taken away, sorted; the server keeps the list unique. */
export const toggleWeekday = (weekdays: readonly number[], isoWeekday: number): number[] =>
	(weekdays.includes(isoWeekday)
		? weekdays.filter((day) => day !== isoWeekday)
		: [...weekdays, isoWeekday]
	).toSorted((a, b) => a - b)
