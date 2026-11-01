import * as Tabs from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { segmentedToggleItemVariants, segmentedToggleVariants } from '@/shared/ui'

import { isStatsTab, STATS_TABS } from '../lib/training-stats.constants'
import type { StatsTab } from '../lib/training-stats.types'

interface StatsTabsProps {
	value: StatsTab
	onValueChange: (value: StatsTab) => void
	/** The period row sits between the tab list and the panel. */
	periodToggle: ReactNode
	renderPanel: (tab: StatsTab) => ReactNode
}

/** «Огляд · Вправи · Кардіо» on Radix Tabs, in the look of the period segments (mockups/training-stats.html). */
export const StatsTabs = ({ value, onValueChange, periodToggle, renderPanel }: StatsTabsProps) => {
	const { t } = useTranslation()

	return (
		<Tabs.Root
			value={value}
			onValueChange={(next) => {
				if (isStatsTab(next)) onValueChange(next)
			}}
			className="flex flex-col gap-2.5 px-gutter pb-4"
		>
			<Tabs.List
				aria-label={t('training.stats.tabs.aria')}
				className={segmentedToggleVariants({ size: 'wide' })}
			>
				{STATS_TABS.map((tab) => (
					<Tabs.Trigger
						key={tab}
						value={tab}
						className={segmentedToggleItemVariants({ size: 'wide', isSelected: tab === value })}
					>
						{t(`training.stats.tabs.${tab}`)}
					</Tabs.Trigger>
				))}
			</Tabs.List>
			{periodToggle}
			{STATS_TABS.map((tab) => (
				<Tabs.Content key={tab} value={tab} className="flex flex-col gap-2.5">
					{renderPanel(tab)}
				</Tabs.Content>
			))}
		</Tabs.Root>
	)
}
