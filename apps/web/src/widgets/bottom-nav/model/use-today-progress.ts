import { useQuery } from '@tanstack/react-query'

import { dayQueryOptions, useLocalToday } from '@/entities/day'
import { useSessionUser } from '@/entities/session'
import { getDayProgress, getDayStats } from '@/entities/stats'

/** The day the chat header shows (same query, shared cache): the ring fills as food is logged. */
export const useTodayProgress = (): number => {
	const user = useSessionUser()
	// the layout renders only for a signed-in user; the zone is a fallback for the types
	const today = useLocalToday(user?.timezone ?? 'UTC')
	const { data } = useQuery({ ...dayQueryOptions(today), enabled: user !== null })
	return data ? getDayProgress(getDayStats(data)) : 0
}
