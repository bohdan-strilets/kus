import type { UseQueryResult } from '@tanstack/react-query'
import type { DayResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { DaySummaryCard, getDayStats } from '@/entities/stats'
import { SetGoalLink } from '@/features/set-goal'
import { Icon, ICON_SIZE, IconButton, Skeleton, Surface, Text } from '@/shared/ui'

/** The day card under the chat header in its three states: loading, failed, the day. */
export const DaySummarySlot = ({ query }: { query: UseQueryResult<DayResponse> }) => {
	const { t } = useTranslation()

	if (query.isPending) {
		return (
			<Surface
				variant="translucent"
				role="status"
				aria-label={t('common.loading')}
				className="flex items-center gap-3.5 px-4 py-3.5"
			>
				<Skeleton shape="block" className="h-17.5 w-28 rounded-tile" />
				<Skeleton shape="block" className="h-15 flex-1 rounded-tile" />
			</Surface>
		)
	}
	if (query.isError) {
		return (
			<Surface
				variant="translucent"
				role="alert"
				className="flex items-center justify-between gap-3 py-2 pr-2 pl-4"
			>
				<Text variant="caption" tone="muted">
					{t('chat.dayLoadError')}
				</Text>
				<IconButton label={t('common.retry')} onClick={() => void query.refetch()}>
					<Icon name="retry" size={ICON_SIZE.control} />
				</IconButton>
			</Surface>
		)
	}
	const { eaten, goal, macros } = getDayStats(query.data)
	return (
		<DaySummaryCard
			eaten={eaten}
			goal={goal}
			macros={macros}
			footer={goal === null ? <SetGoalLink /> : undefined}
		/>
	)
}
