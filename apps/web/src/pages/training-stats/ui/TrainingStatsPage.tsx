import type { WorkoutStatsPeriod } from '@kus/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { PeriodToggle, workoutStatsQueryOptions } from '@/entities/workout'
import { ROUTES, TAB_ROUTES } from '@/shared/config'
import { InlineError, ScreenHeader } from '@/shared/ui'

import { DEFAULT_STATS_PERIOD } from '../lib/training-stats.constants'
import type { StatsTab } from '../lib/training-stats.types'
import { CardioTab } from './CardioTab'
import { ExercisesTab } from './ExercisesTab'
import { OverviewTab } from './OverviewTab'
import { StatsEmpty } from './StatsEmpty'
import { StatsSkeleton } from './StatsSkeleton'
import { StatsTabs } from './StatsTabs'

/** design/mockups/training-stats.html: the overview, the exercises and the cardio of a period. */
export const TrainingStatsPage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const [tab, setTab] = useState<StatsTab>('overview')
	const [period, setPeriod] = useState<WorkoutStatsPeriod>(DEFAULT_STATS_PERIOD)
	// the previous numbers stay on screen while the new period loads (placeholderData), so tabs draw by the period of the data
	const query = useQuery(workoutStatsQueryOptions(period))

	const renderPanel = (panelTab: StatsTab) => {
		const stats = query.data
		if (!stats) {
			return query.isError ? (
				<InlineError message={t('training.stats.loadError')} onRetry={() => void query.refetch()} />
			) : (
				<StatsSkeleton />
			)
		}
		if (stats.overview.workoutCount === 0) {
			return <StatsEmpty onAction={() => void navigate(ROUTES.chat, { replace: true })} />
		}
		if (panelTab === 'exercises')
			return <ExercisesTab exercises={stats.exercises} period={stats.period} />
		if (panelTab === 'cardio') return <CardioTab stats={stats} period={stats.period} />
		return <OverviewTab stats={stats} period={stats.period} />
	}

	return (
		<>
			<ScreenHeader title={t('pages.trainingStats.title')} backTo={TAB_ROUTES.training} />
			<StatsTabs
				value={tab}
				onValueChange={setTab}
				periodToggle={<PeriodToggle value={period} onChange={setPeriod} />}
				renderPanel={renderPanel}
			/>
		</>
	)
}
