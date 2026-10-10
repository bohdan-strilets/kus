import type { UseQueryResult } from '@tanstack/react-query'
import type { DayResponse } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DaySummaryCard, getDayStats } from '@/entities/stats'
import { EditGoalsSheet, SetGoalLink, toGoalValues } from '@/features/edit-goals'
import { InlineError, Skeleton, Surface } from '@/shared/ui'

/** The day card under the chat header in its three states: loading, failed, the day. */
export const DaySummarySlot = ({ query }: { query: UseQueryResult<DayResponse> }) => {
	const { t } = useTranslation()
	const [isGoalOpen, setIsGoalOpen] = useState(false)
	const openGoal = (): void => {
		setIsGoalOpen(true)
	}

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
		return <InlineError message={t('chat.dayLoadError')} onRetry={() => void query.refetch()} />
	}
	const { eaten, goal, macros } = getDayStats(query.data)
	return (
		<>
			<DaySummaryCard
				eaten={eaten}
				goal={goal}
				macros={macros}
				goalAction={goal === null ? undefined : { label: t('goal.change'), onClick: openGoal }}
				footer={goal === null ? <SetGoalLink onClick={openGoal} /> : undefined}
			/>
			<EditGoalsSheet
				isOpen={isGoalOpen}
				onOpenChange={setIsGoalOpen}
				goal={toGoalValues(query.data.goal)}
			/>
		</>
	)
}
