import { useEffect, useState } from 'react'

import { getLocalDateString } from '@/shared/lib'

/** Often enough to notice midnight in an open tab, rare enough to cost nothing. */
const CHECK_INTERVAL_MS = 60_000

/**
 * Today (`YYYY-MM-DD`) in the user's timezone — the day the API sums. Moves on at midnight while
 * the tab stays open and when it comes back from the background.
 */
export const useLocalToday = (timeZone: string): string => {
	const [today, setToday] = useState(() => getLocalDateString(new Date(), timeZone))

	useEffect(() => {
		const update = (): void => {
			setToday(getLocalDateString(new Date(), timeZone))
		}
		update()
		const timer = setInterval(update, CHECK_INTERVAL_MS)
		document.addEventListener('visibilitychange', update)
		return () => {
			clearInterval(timer)
			document.removeEventListener('visibilitychange', update)
		}
	}, [timeZone])

	return today
}
