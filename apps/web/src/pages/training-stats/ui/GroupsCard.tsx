import type { WorkoutStatsGroup } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatWorkoutTotal, GroupDot, StatsPanel } from '@/entities/workout'
import { formatInteger } from '@/shared/lib'
import { Text } from '@/shared/ui'

import { getGroupRows } from '../lib/get-group-rows'

interface GroupsCardProps {
	groups: readonly WorkoutStatsGroup[]
	cardioMin: number
}

const NEUTRAL_BAR_CLASS = 'block h-2.5 w-full rounded-full bg-muted-soft'

/**
 * «Підходи за групами»: strength sets only, a bar per group scaled to the biggest one. Cardio is
 * time, not sets: its own row with minutes and no bar, so the scales are never mixed.
 */
export const GroupsCard = ({ groups, cardioMin }: GroupsCardProps) => {
	const { t } = useTranslation()
	const rows = getGroupRows(groups)
	if (rows.length === 0 && cardioMin === 0) return null

	return (
		<StatsPanel
			title={t('training.stats.overview.groups.title')}
			aside={cardioMin > 0 ? t('training.stats.overview.groups.cardioHint') : undefined}
		>
			<ul className="flex flex-col gap-2.5">
				{cardioMin > 0 && (
					<li className="flex items-center gap-2.5">
						<Text as="span" variant="caption" weight="bold" className="w-16 shrink-0">
							{t('muscle.CARDIO')}
						</Text>
						<span className="flex-1" />
						<Text as="span" variant="caption" weight="bold" isTabular>
							{formatWorkoutTotal(cardioMin, t)}
						</Text>
					</li>
				)}
				{rows.map((row) => (
					<li key={row.group ?? 'other'} className="flex items-center gap-2.5">
						<Text as="span" variant="caption" weight="bold" className="w-16 shrink-0">
							{row.group === null
								? t('training.stats.overview.groups.other')
								: t(`muscle.${row.group}`)}
						</Text>
						<span className="flex-1 rounded-full bg-track">
							<span className="block" style={{ width: `${row.widthPercent}%` }}>
								{row.group === null ? (
									<span className={NEUTRAL_BAR_CLASS} />
								) : (
									<GroupDot group={row.group} className="h-2.5 w-full" />
								)}
							</span>
						</span>
						<Text as="span" variant="caption" weight="bold" isTabular className="w-8 text-right">
							{formatInteger(row.setCount)}
						</Text>
					</li>
				))}
			</ul>
		</StatsPanel>
	)
}
