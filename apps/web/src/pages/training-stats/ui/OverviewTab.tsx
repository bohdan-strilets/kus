import type { WorkoutStatsPeriod, WorkoutStatsResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { StatsNote, StatsPanel, StatTile } from '@/entities/workout'
import { formatInteger } from '@/shared/lib'
import { BarChart } from '@/shared/ui'

import { getBucketBars } from '../lib/get-bucket-bars'
import { getOverviewTiles } from '../lib/get-overview-tiles'
import { MIN_WORKOUTS_FOR_CHART } from '../lib/training-stats.constants'
import { GroupsCard } from './GroupsCard'
import { KcalTile } from './KcalTile'

interface OverviewTabProps {
	stats: WorkoutStatsResponse
	period: WorkoutStatsPeriod
}

/** «Огляд»: two numbers, the kcal of the period, workouts per week (per day for a week) and sets by group. */
export const OverviewTab = ({ stats, period }: OverviewTabProps) => {
	const { t } = useTranslation()
	const { overview } = stats
	const tiles = getOverviewTiles(overview, period, t)
	const chartTitle = t(
		period === 'week'
			? 'training.stats.overview.weeklyChart.titleDays'
			: 'training.stats.overview.weeklyChart.title',
	)
	const bars = getBucketBars({
		buckets: overview.buckets,
		period,
		values: overview.buckets.map((bucket) => bucket.workoutCount),
		describe: (label, count) => t('training.stats.overview.weeklyChart.barAria', { label, count }),
	})

	return (
		<>
			<div className="flex gap-2">
				<StatTile
					label={t('training.stats.overview.sessions', { count: tiles.workoutCount })}
					value={formatInteger(tiles.workoutCount)}
					note={tiles.perWeek}
				/>
				<StatTile
					label={t('training.stats.overview.total')}
					value={tiles.total}
					srNote={tiles.isTotalUnknown ? t('training.stats.overview.totalUnknown') : undefined}
					note={tiles.perSession}
				/>
			</div>
			{overview.burned !== null && <KcalTile burned={overview.burned} period={period} />}
			{overview.workoutCount < MIN_WORKOUTS_FOR_CHART ? (
				<StatsNote text={t('training.stats.single.overview')} />
			) : (
				<StatsPanel title={chartTitle}>
					<BarChart bars={bars} listLabel={chartTitle} />
				</StatsPanel>
			)}
			<GroupsCard groups={overview.groups} cardioMin={stats.cardio.durationMin} />
		</>
	)
}
