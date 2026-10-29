import { queryOptions } from '@tanstack/react-query'

import { getWorkoutsInRange, getWorkoutsOfDay } from '../api/get-workouts'

/** Every workout read lives under this key: a deleted or restored training invalidates them all. */
export const WORKOUTS_QUERY_KEY = ['workouts'] as const

export const workoutsDayQueryOptions = (localDate: string) =>
	queryOptions({
		queryKey: [...WORKOUTS_QUERY_KEY, 'day', localDate],
		queryFn: () => getWorkoutsOfDay(localDate),
	})

export const workoutsRangeQueryOptions = (range: { from: string; to: string }) =>
	queryOptions({
		queryKey: [...WORKOUTS_QUERY_KEY, 'range', range.from, range.to],
		queryFn: () => getWorkoutsInRange(range),
	})
