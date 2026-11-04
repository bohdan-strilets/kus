import { FORM_MAX_DAYS_BACK, getDayOffset } from '@kus/shared'

import { getLocalDateString, getZonedMoment, toDbDate } from '../../common/time'
import { FORM_FUTURE_TOLERANCE_MIN } from './workout-logging.constants'
import type { LoggingFieldCode } from './workout-logging.exceptions'

const MS_PER_MINUTE = 60_000

export interface FormTime {
	startedAt: Date
	finishedAt: Date
}

export interface FormTimeIssue {
	field: 'localDate' | 'startTime'
	code: Extract<LoggingFieldCode, 'TOO_OLD' | 'IN_FUTURE'>
}

/**
 * The start (the day and `HH:mm` on the user's wall clock) and the finish after `durationMin`,
 * never later than `now` (a session started 30 min ago that «lasted» 60 has not finished yet).
 */
export const getFormTime = ({
	localDate,
	startTime,
	durationMin,
	timezone,
	now,
}: {
	/** `YYYY-MM-DD` */
	localDate: string
	/** `HH:mm` */
	startTime: string
	durationMin: number
	timezone: string
	now: Date
}): FormTime => {
	const [hour = 0, minute = 0] = startTime.split(':').map(Number)
	const startedAt = getZonedMoment(toDbDate(localDate), hour, timezone, minute)
	const plannedEnd = startedAt.getTime() + durationMin * MS_PER_MINUTE
	// a start within the phone-clock tolerance may be after `now`: the finish is then the start
	const finishedAt = new Date(Math.max(startedAt.getTime(), Math.min(plannedEnd, now.getTime())))
	return { startedAt, finishedAt }
}

/**
 * The form logs today and FORM_MAX_DAYS_BACK days before it (the user's calendar), never a start
 * later than now (a few minutes of a fast phone clock aside). Null when the time is fine.
 */
export const findFormTimeIssue = ({
	localDate,
	startedAt,
	now,
	timezone,
}: {
	localDate: string
	startedAt: Date
	now: Date
	timezone: string
}): FormTimeIssue | null => {
	const offset = getDayOffset(localDate, getLocalDateString(now, timezone))
	if (offset > 0) return { field: 'localDate', code: 'IN_FUTURE' }
	if (offset < -FORM_MAX_DAYS_BACK) return { field: 'localDate', code: 'TOO_OLD' }
	if (startedAt.getTime() > now.getTime() + FORM_FUTURE_TOLERANCE_MIN * MS_PER_MINUTE) {
		return { field: 'startTime', code: 'IN_FUTURE' }
	}
	return null
}
