import type { WorkoutStatsPeriod } from '@kus/shared'

export const DEFAULT_EXERCISE_PERIOD: WorkoutStatsPeriod = 'month'

/** The chart is a line: it needs two points, one point is told in words. */
export const MIN_POINTS_FOR_CHART = 2

export const EXERCISE_METRICS = ['weight', 'reps'] as const

export type ExerciseMetric = (typeof EXERCISE_METRICS)[number]
