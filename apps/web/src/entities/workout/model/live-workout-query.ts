import type { LiveWorkoutResponse } from '@kus/shared'
import { queryOptions, type QueryClient, useQuery } from '@tanstack/react-query'

import { getLiveWorkout } from '../api/live-workout'
import { WORKOUTS_QUERY_KEY } from './workout-query'

/** The open live session; under the workouts key, so a finished or deleted training refreshes it. */
export const LIVE_WORKOUT_QUERY_KEY = [...WORKOUTS_QUERY_KEY, 'live'] as const

/**
 * Never trusted as fresh: the chat can change the session at any moment, so every mount and every
 * return to the window reads it again (the cached copy shows meanwhile).
 */
export const liveWorkoutQueryOptions = () =>
	queryOptions({
		queryKey: LIVE_WORKOUT_QUERY_KEY,
		queryFn: getLiveWorkout,
		staleTime: 0,
		refetchOnWindowFocus: 'always',
	})

/** `data` is null when no session is open, undefined while the first read runs. */
export const useLiveWorkout = () => useQuery(liveWorkoutQueryOptions())

/** Writes an answer of the API into the cache (null: the session is closed). */
export const setLiveWorkout = (
	queryClient: QueryClient,
	live: LiveWorkoutResponse | null,
): void => {
	queryClient.setQueryData(LIVE_WORKOUT_QUERY_KEY, live)
}
