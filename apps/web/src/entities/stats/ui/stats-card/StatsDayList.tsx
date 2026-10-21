import { Text } from '@/shared/ui'

import type { StatsCardDayRow } from '../../lib/get-stats-card-view'

interface StatsDayListProps {
	rows: readonly StatsCardDayRow[]
}

/** «Нд, 18.10 … 2 380 ккал»: the few days a sparse card has, as plain facts (chat-stats-card). */
export const StatsDayList = ({ rows }: StatsDayListProps) => (
	<ul className="flex flex-col divide-y divide-divider border-t border-divider">
		{rows.map(({ date, label, kcal }) => (
			<li key={date} className="flex items-baseline justify-between py-1.5">
				<Text as="span" variant="cardTitle" weight="semibold">
					{label}
				</Text>
				<Text as="span" variant="cardTitle" isTabular>
					{kcal}
				</Text>
			</li>
		))}
	</ul>
)
