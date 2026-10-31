import { queryOptions } from '@tanstack/react-query'

import { getWorkout } from '../api/get-workout'
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

/**
 * Under the shared key, so deleting or restoring a training refreshes the open screen too. Not kept
 * fresh: the session grows through the chat, so every opening reads it again (the cached copy shows
 * meanwhile). Errors retry by the app default — never a 4xx.
 */
export const workoutQueryOptions = (workoutId: string) =>
	queryOptions({
		queryKey: [...WORKOUTS_QUERY_KEY, 'detail', workoutId],
		queryFn: () => getWorkout(workoutId),
		staleTime: 0,
	})
