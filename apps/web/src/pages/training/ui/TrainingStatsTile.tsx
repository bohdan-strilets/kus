import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { workoutStatsQueryOptions } from '@/entities/workout'
import { TRAINING_STATS_ROUTE } from '@/shared/config'
import { formatMonthLong, toCalendarDate } from '@/shared/lib'
import { Icon, Surface, Text } from '@/shared/ui'

const TILE_ICON_SIZE = 20

/**
 * mockups/training-home.html «Статистика» under the week card: the whole tile opens the stats.
 * The count shares the cache with the «Місяць» tab of the stats; while it loads or fails the tile
 * keeps its height and shows the title only.
 */
export const TrainingStatsTile = ({ today }: { today: string }) => {
	const { t } = useTranslation()
	const { data } = useQuery(workoutStatsQueryOptions('month'))
	const month = formatMonthLong(toCalendarDate(today)).toLocaleLowerCase('uk')

	return (
		<Surface variant="list" radius="chip" shadow="list">
			<Link
				to={TRAINING_STATS_ROUTE}
				className="flex min-h-16 items-center gap-3 rounded-chip px-3.5 py-2.5 text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
			>
				<span
					aria-hidden="true"
					className="flex size-9 flex-none items-center justify-center rounded-icon bg-hint-training-bg text-hint-training-ink"
				>
					<Icon name="progress" size={TILE_ICON_SIZE} />
				</span>
				<span className="flex min-w-0 flex-col">
					<Text as="span" variant="cardTitle" weight="bold">
						{t('training.stats.tile.title')}
					</Text>
					{data && (
						<Text as="span" variant="small" tone="muted" className="truncate">
							{t('training.stats.tile.monthCount', { count: data.overview.workoutCount, month })}
						</Text>
					)}
				</span>
			</Link>
		</Surface>
	)
}
