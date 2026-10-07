import { useTranslation } from 'react-i18next'

import { formatInteger } from '@/shared/lib'
import { Surface, Text } from '@/shared/ui'

import type { MacroProgressSet } from '../../model/macro.types'
import { CalorieGauge } from '../calorie-gauge/CalorieGauge'
import { MacroTiles } from '../macro-tiles/MacroTiles'

export interface DayStatsCardProps {
	eaten: number
	goal: number
	macros: MacroProgressSet
}

const SideStat = ({ value, label }: { value: number; label: string }) => (
	<div className="flex w-17.5 flex-col items-center">
		<Text as="span" variant="stat">
			{formatInteger(value)}
		</Text>
		<Text as="span" variant="small" weight="regular" tone="muted">
			{label}
		</Text>
	</div>
)

/**
 * The day card on «Сьогодні» (mockups/today.html, today-over.html): eaten on the left, the large
 * half-ring in the middle, the goal on the right, then the three macro tiles with bars.
 */
export const DayStatsCard = ({ eaten, goal, macros }: DayStatsCardProps) => {
	const { t } = useTranslation()

	return (
		<Surface variant="frosted" radius="panel" className="flex flex-col gap-3.5 p-4">
			<div className="flex items-end justify-between">
				<SideStat value={eaten} label={t('gauge.eaten')} />
				<CalorieGauge eaten={eaten} goal={goal} size="large" />
				<SideStat value={goal} label={t('gauge.goal')} />
			</div>
			<MacroTiles macros={macros} variant="bar" />
		</Surface>
	)
}
