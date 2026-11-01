import type { WorkoutStatsPeriod } from '@kus/shared'

export const STATS_TABS = ['overview', 'exercises', 'cardio'] as const

export const DEFAULT_STATS_PERIOD: WorkoutStatsPeriod = 'month'

/** Below this many workouts a chart has nothing to compare: the overview says so in words. */
export const MIN_WORKOUTS_FOR_CHART = 2

export const EMPTY_VALUE = '—'

export const PERCENT = 100

export const isStatsTab = (value: string): value is (typeof STATS_TABS)[number] =>
	STATS_TABS.some((tab) => tab === value)
