import type { WorkoutStatsPeriod, WorkoutStatsResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatNumber, formatWorkoutTotal } from '@/entities/workout'

import { EMPTY_VALUE } from './training-stats.constants'

export interface OverviewTiles {
	workoutCount: number
	/** «3 на тиждень»; a week is its own average, so it has no line. */
	perWeek: string | null
	total: string
	/** Workouts exist but none has a named duration: the total is a dash, not «0 хв». */
	isTotalUnknown: boolean
	/** «≈ 58 хв за раз», the «≈» only while an estimated duration is in the sum. */
	perSession: string | null
}

export const getOverviewTiles = (
	overview: WorkoutStatsResponse['overview'],
	period: WorkoutStatsPeriod,
	t: TFunction,
): OverviewTiles => {
	const { avgPerWeek, avgDurationMin, hasEstimatedDuration } = overview
	const isTotalUnknown = overview.workoutCount > 0 && avgDurationMin === null
	return {
		workoutCount: overview.workoutCount,
		perWeek:
			avgPerWeek === null || period === 'week'
				? null
				: t('training.stats.overview.avgPerWeek', { value: formatNumber(avgPerWeek) }),
		total: isTotalUnknown ? EMPTY_VALUE : formatWorkoutTotal(overview.durationMin, t),
		isTotalUnknown,
		perSession:
			avgDurationMin === null
				? null
				: t(
						hasEstimatedDuration
							? 'training.stats.overview.avgPerSessionEstimated'
							: 'training.stats.overview.avgPerSession',
						{ duration: formatWorkoutTotal(avgDurationMin, t) },
					),
	}
}
