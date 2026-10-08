import type { UseQueryResult } from '@tanstack/react-query'
import type { DayResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { DayStatsCard, getDayStats, getGaugeState, SupportCard } from '@/entities/stats'
import { formatInteger } from '@/shared/lib'
import { Hamster, Skeleton, InlineError } from '@/shared/ui'

import { getSupportKey } from '../lib/get-support-key'
import { MealsList } from './MealsList'
import { TodayEmpty } from './TodayEmpty'

const SUPPORT_HAMSTER_SIZE = 44
const SKELETON_ROWS = 3

interface DayContentProps {
	query: UseQueryResult<DayResponse>
	isToday: boolean
	onGoalClick: () => void
	/** The empty state's action: the chat today, back to today for a past day. */
	onEmptyAction: () => void
}

/** The chosen day on «Сьогодні»: its card, meals and a word of support — or why there is nothing. */
export const DayContent = ({ query, isToday, onGoalClick, onEmptyAction }: DayContentProps) => {
	const { t } = useTranslation()

	if (query.isPending) {
		return (
			<div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2">
				<Skeleton shape="block" className="h-58 rounded-panel" />
				{Array.from({ length: SKELETON_ROWS }, (_, index) => (
					<Skeleton key={index} shape="block" className="h-16 rounded-bubble" />
				))}
			</div>
		)
	}
	if (query.isError) {
		return <InlineError message={t('today.loadError')} onRetry={() => void query.refetch()} />
	}
	if (query.data.meals.length === 0) {
		return <TodayEmpty isToday={isToday} onAction={onEmptyAction} />
	}

	const { eaten, goal, macros } = getDayStats(query.data)
	const gauge = getGaugeState(eaten, goal ?? 0)
	return (
		<div className="flex flex-col gap-2.5">
			<DayStatsCard
				eaten={eaten}
				goal={goal}
				macros={macros}
				goalAction={{ label: t(goal === null ? 'goal.set' : 'goal.change'), onClick: onGoalClick }}
			/>
			<MealsList meals={query.data.meals} />
			{gauge.status === 'over' && (
				<SupportCard
					message={t(getSupportKey(gauge.over), { over: formatInteger(gauge.over) })}
					avatar={<Hamster mood="support" size={SUPPORT_HAMSTER_SIZE} />}
				/>
			)}
		</div>
	)
}
