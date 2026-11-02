import type { WorkoutStatsPeriod, WorkoutStatsResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import {
	formatCardioSummary,
	formatWorkoutDistance,
	formatWorkoutTotal,
	StatsNote,
	StatsPanel,
	StatTile,
} from '@/entities/workout'
import { BarChart } from '@/shared/ui'

import { getBucketBars } from '../lib/get-bucket-bars'
import { EMPTY_VALUE } from '../lib/training-stats.constants'
import { CardioExercises } from './CardioExercises'

interface CardioTabProps {
	stats: WorkoutStatsResponse
	period: WorkoutStatsPeriod
}

/** «Кардіо»: time and distance, minutes per week (per day for a week) and the machines. */
export const CardioTab = ({ stats, period }: CardioTabProps) => {
	const { t } = useTranslation()
	const { cardio } = stats
	if (cardio.sessionCount === 0) return <StatsNote text={t('training.stats.empty.cardio')} />

	const chartTitle = t(
		period === 'week'
			? 'training.stats.cardio.weeklyChart.titleDays'
			: 'training.stats.cardio.weeklyChart.title',
	)
	const bars = getBucketBars({
		buckets: cardio.buckets,
		period,
		values: cardio.buckets.map((bucket) => bucket.minutes),
		describe: (label, minutes) => `${label}: ${formatWorkoutTotal(minutes, t)}`,
	})
	const hasDistance = cardio.distanceM > 0

	return (
		<>
			<div className="flex gap-2">
				<StatTile
					tone="cardio"
					label={t('training.stats.cardio.tiles.time')}
					value={formatWorkoutTotal(cardio.durationMin, t)}
				/>
				<StatTile
					tone="cardio"
					label={t('training.stats.cardio.tiles.distance')}
					value={hasDistance ? formatWorkoutDistance(cardio.distanceM, t) : EMPTY_VALUE}
					srNote={hasDistance ? undefined : t('training.stats.cardio.noDistance')}
				/>
			</div>
			<StatsPanel title={chartTitle}>
				<BarChart tone="cardio" bars={bars} listLabel={chartTitle} />
			</StatsPanel>
			<CardioExercises
				exercises={cardio.byExercise}
				summary={formatCardioSummary(
					{ durationMin: cardio.durationMin, distanceM: hasDistance ? cardio.distanceM : null },
					t,
				)}
			/>
		</>
	)
}
