import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { shiftLocalDate } from '@/shared/lib'

import { getWeekStart, WEEK_LENGTH } from '../lib/get-week-days'
import { getLastViewableDate, resolveSelectedDate } from '../lib/resolve-selected-date'

const DATE_PARAM = 'date'

export interface DayNavigation {
	/** `YYYY-MM-DD` on screen. */
	selected: string
	/** The last day of the week strip. */
	windowEnd: string
	select: (localDate: string) => void
	showPreviousWeek: () => void
	/** null at the current week: there is nothing after tomorrow. */
	showNextWeek: (() => void) | null
}

/**
 * The chosen day lives in `?date=` (a reload or a shared link keeps it; it replaces the history
 * entry, so Back leaves the screen instead of stepping through days); the strip shows the
 * 7 days ending on `windowEnd`, and ‹ › move it by a week. The current week ends tomorrow and
 * follows the clock; only a past week is pinned (`pastWindowEnd`).
 */
export const useDayNavigation = (today: string): DayNavigation => {
	const [params, setParams] = useSearchParams()
	const lastDate = getLastViewableDate(today)
	const selected = resolveSelectedDate(params.get(DATE_PARAM), today)

	const [pastWindowEnd, setPastWindowEnd] = useState<string | null>(null)

	const windowEnd = pastWindowEnd ?? lastDate
	// a day picked from outside the strip (a link, back) brings its week along (adjusted in render)
	if (selected > windowEnd || selected < getWeekStart(windowEnd)) {
		setPastWindowEnd(selected >= getWeekStart(lastDate) ? null : selected)
	}

	const select = (localDate: string): void => {
		setParams(localDate === today ? {} : { [DATE_PARAM]: localDate }, { replace: true })
	}
	const moveWindow = (end: string): void => {
		setPastWindowEnd(end >= lastDate ? null : end)
		// the day to land on is never later than today: tomorrow is only opened on purpose
		select(end > today ? today : end)
	}

	return {
		selected,
		windowEnd,
		select,
		showPreviousWeek: () => {
			moveWindow(shiftLocalDate(windowEnd, -WEEK_LENGTH))
		},
		showNextWeek:
			windowEnd < lastDate
				? () => {
						const next = shiftLocalDate(windowEnd, WEEK_LENGTH)
						moveWindow(next > lastDate ? lastDate : next)
					}
				: null,
	}
}
