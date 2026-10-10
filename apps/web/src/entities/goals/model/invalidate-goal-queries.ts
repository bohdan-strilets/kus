import type { QueryClient } from '@tanstack/react-query'

import { DAY_QUERY_KEY } from '@/entities/day'

// Same key as PROFILE_QUERY_KEY, written out so that entities stay independent of each other.
// It covers the profile and the goals preview under it.
const PROFILE_KEY = ['profile'] as const

/**
 * A new goal changes the ring in the chat header, the BottomNav ring, «Сьогодні», the week strip
 * (all inside the day queries) and the profile itself.
 */
export const invalidateGoalQueries = async (queryClient: QueryClient): Promise<void> => {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: DAY_QUERY_KEY }),
		queryClient.invalidateQueries({ queryKey: PROFILE_KEY }),
	])
}
