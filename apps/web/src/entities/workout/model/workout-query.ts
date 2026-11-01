import type { ExerciseDictionaryQuery, WorkoutStatsPeriod } from '@kus/shared'
import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { getExerciseDictionary } from '../api/get-exercise-dictionary'
import { getExerciseStats } from '../api/get-exercise-stats'
import { getWorkout } from '../api/get-workout'
import { getWorkoutStats } from '../api/get-workout-stats'
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

const WORKOUT_STATS_STALE_TIME_MS = 60_000

/**
 * Under the shared key, so a chat turn, a delete or a restore refreshes the stats too. Switching
 * the period keeps the previous numbers on screen until the new ones arrive.
 */
export const workoutStatsQueryOptions = (period: WorkoutStatsPeriod) =>
	queryOptions({
		queryKey: [...WORKOUTS_QUERY_KEY, 'stats', period],
		queryFn: () => getWorkoutStats(period),
		staleTime: WORKOUT_STATS_STALE_TIME_MS,
		placeholderData: keepPreviousData,
	})

export const exerciseStatsQueryOptions = (exerciseId: string, period: WorkoutStatsPeriod) =>
	queryOptions({
		queryKey: [...WORKOUTS_QUERY_KEY, 'exercise', exerciseId, period],
		queryFn: () => getExerciseStats({ exerciseId, period }),
		staleTime: WORKOUT_STATS_STALE_TIME_MS,
	})

/** Every dictionary list (any search, any group): a new exercise in a program makes them stale. */
export const EXERCISE_DICTIONARY_QUERY_KEY = [...WORKOUTS_QUERY_KEY, 'dictionary'] as const

/** The dictionary changes with the workouts, which invalidate the whole key; a typed query keeps the previous list meanwhile. */
export const exerciseDictionaryQueryOptions = (query: ExerciseDictionaryQuery) =>
	queryOptions({
		queryKey: [...EXERCISE_DICTIONARY_QUERY_KEY, query.query ?? '', query.group ?? null],
		queryFn: () => getExerciseDictionary(query),
		staleTime: WORKOUT_STATS_STALE_TIME_MS,
		placeholderData: keepPreviousData,
	})
