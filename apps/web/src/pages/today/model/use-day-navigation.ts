import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { shiftLocalDate } from '@/shared/lib'

import { getWeekStart, WEEK_LENGTH } from '../lib/get-week-days'
import { resolveSelectedDate } from '../lib/resolve-selected-date'

const DATE_PARAM = 'date'

export interface DayNavigation {
	/** `YYYY-MM-DD` on screen. */
	selected: string
	/** The last day of the week strip. */
	windowEnd: string
	select: (localDate: string) => void
	showPreviousWeek: () => void
	/** null at the current week: there is nothing after today. */
	showNextWeek: (() => void) | null
}

/**
 * The chosen day lives in `?date=` (a reload or a shared link keeps it; it replaces the history
 * entry, so Back leaves the screen instead of stepping through days); the strip shows the
 * 7 days ending on `windowEnd`, and ‹ › move it by a week, choosing its last day.
 */
export const useDayNavigation = (today: string): DayNavigation => {
	const [params, setParams] = useSearchParams()
	const selected = resolveSelectedDate(params.get(DATE_PARAM), today)
	const [windowEnd, setWindowEnd] = useState(selected)
	// a day picked from outside the strip (a link, back) brings its week along (adjusted in render)
	if (selected > windowEnd || selected < getWeekStart(windowEnd)) setWindowEnd(selected)

	const select = (localDate: string): void => {
		setParams(localDate === today ? {} : { [DATE_PARAM]: localDate }, { replace: true })
	}
	const moveWindow = (end: string): void => {
		setWindowEnd(end)
		select(end)
	}

	return {
		selected,
		windowEnd,
		select,
		showPreviousWeek: () => {
			moveWindow(shiftLocalDate(windowEnd, -WEEK_LENGTH))
		},
		showNextWeek:
			windowEnd < today
				? () => {
						const next = shiftLocalDate(windowEnd, WEEK_LENGTH)
						moveWindow(next > today ? today : next)
					}
				: null,
	}
}
