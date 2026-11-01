import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { workoutStatsQueryOptions } from '@/entities/workout'
import { TRAINING_STATS_ROUTE } from '@/shared/config'
import { formatMonthLong, toCalendarDate } from '@/shared/lib'

import { TrainingTile } from './TrainingTile'

interface TrainingStatsTileProps {
	today: string
	/** The «Програма» tile sits beside: the subtitle is the short «11 за жовтень». */
	isShort?: boolean
}

/**
 * mockups/training-home.html «Статистика»: the whole tile opens the stats.
 * The count shares the cache with the «Місяць» tab of the stats; while it loads or fails the tile
 * keeps its height and shows the title only.
 */
export const TrainingStatsTile = ({ today, isShort = false }: TrainingStatsTileProps) => {
	const { t } = useTranslation()
	const { data } = useQuery(workoutStatsQueryOptions('month'))
	const month = formatMonthLong(toCalendarDate(today)).toLocaleLowerCase('uk')

	return (
		<TrainingTile
			icon="progress"
			title={t('training.stats.tile.title')}
			to={TRAINING_STATS_ROUTE}
			subtitle={
				data &&
				t(isShort ? 'training.stats.tile.monthCountShort' : 'training.stats.tile.monthCount', {
					count: data.overview.workoutCount,
					month,
				})
			}
		/>
	)
}
