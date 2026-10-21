import type { TFunction } from 'i18next'

import { formatShortDate, getDayRelation, shiftLocalDate, toCalendarDate } from '@/shared/lib'

/** A weekday name is told only within the last week; further back the date says it exactly. */
const WEEKDAY_LABEL_DAYS = 6

const WEEKDAY_KEYS = [
	'entry.copied.weekdays.sun',
	'entry.copied.weekdays.mon',
	'entry.copied.weekdays.tue',
	'entry.copied.weekdays.wed',
	'entry.copied.weekdays.thu',
	'entry.copied.weekdays.fri',
	'entry.copied.weekdays.sat',
] as const

/**
 * The mark of an entry copied from an earlier day (mockups/chat-as-yesterday.html): «як учора»,
 * «як у п'ятницю» within a week, «як 16.10» before. null for today or a future day: nothing to
 * copy from there.
 */
export const getCopiedLabel = (sourceDate: string, today: string, t: TFunction): string | null => {
	const relation = getDayRelation(sourceDate, today)
	if (relation === 'yesterday') return t('entry.copied.yesterday')
	if (sourceDate >= today) return null

	const calendarDate = toCalendarDate(sourceDate)
	const isWithinWeek = sourceDate >= shiftLocalDate(today, -WEEKDAY_LABEL_DAYS)
	if (!isWithinWeek) return t('entry.copied.date', { date: formatShortDate(calendarDate) })
	const weekdayKey = WEEKDAY_KEYS[calendarDate.getDay()]
	return weekdayKey ? t(weekdayKey) : null
}
