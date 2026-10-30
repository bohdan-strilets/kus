import * as Tabs from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { MemoryTab } from '../lib/memory-tab.types'
import { memoryTabVariants } from './memory-tabs.variants'

const TAB_ORDER: readonly MemoryTab[] = ['products', 'facts']

interface MemoryTabsProps {
	value: MemoryTab
	onValueChange: (value: MemoryTab) => void
	productsPanel: ReactNode
	factsPanel: ReactNode
}

const isMemoryTab = (value: string): value is MemoryTab => TAB_ORDER.some((tab) => tab === value)

/** «Продукти | Про тебе» on Radix Tabs: arrows move between the tabs, the panel is announced with its tab. */
export const MemoryTabs = ({
	value,
	onValueChange,
	productsPanel,
	factsPanel,
}: MemoryTabsProps) => {
	const { t } = useTranslation()
	const panels: Record<MemoryTab, ReactNode> = { products: productsPanel, facts: factsPanel }

	return (
		<Tabs.Root
			value={value}
			onValueChange={(next) => {
				if (isMemoryTab(next)) onValueChange(next)
			}}
			className="flex min-h-0 flex-1 flex-col gap-3"
		>
			<Tabs.List
				aria-label={t('memory.tabs')}
				className="grid grid-cols-2 gap-1 rounded-tile bg-surface/85 p-1"
			>
				{TAB_ORDER.map((tab) => (
					<Tabs.Trigger
						key={tab}
						value={tab}
						className={memoryTabVariants({ isActive: tab === value })}
					>
						{t(`memory.tab.${tab}`)}
					</Tabs.Trigger>
				))}
			</Tabs.List>
			{TAB_ORDER.map((tab) => (
				<Tabs.Content key={tab} value={tab} className="flex min-h-0 flex-1 flex-col gap-3">
					{panels[tab]}
				</Tabs.Content>
			))}
		</Tabs.Root>
	)
}
