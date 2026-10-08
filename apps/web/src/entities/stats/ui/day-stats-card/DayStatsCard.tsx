import { useTranslation } from 'react-i18next'

import { cn, formatInteger } from '@/shared/lib'
import { Surface, Text } from '@/shared/ui'

import type { MacroProgressSet } from '../../model/macro.types'
import { CalorieGauge } from '../calorie-gauge/CalorieGauge'
import { MacroTiles } from '../macro-tiles/MacroTiles'

export interface DayStatsCardProps {
	eaten: number
	/** null without a goal: the gauge shows what was eaten, the goal side reads «—». */
	goal: number | null
	macros: MacroProgressSet
	/** A tap on «ціль» opens the goal sheet; label — «Змінити ціль» / «Задати ціль». */
	goalAction?: { label: string; onClick: () => void }
}

const STAT_CLASS = 'flex w-17.5 flex-col items-center'

const SideStatContent = ({ value, label }: { value: string; label: string }) => (
	<>
		<Text as="span" variant="stat">
			{value}
		</Text>
		<Text as="span" variant="small" weight="regular" tone="muted">
			{label}
		</Text>
	</>
)

/**
 * The day card on «Сьогодні» (mockups/today.html, today-over.html): eaten on the left, the large
 * half-ring in the middle, the goal on the right, then the three macro tiles with bars. Without a
 * goal the ring itself shows what was eaten, so the left side stays empty.
 */
export const DayStatsCard = ({ eaten, goal, macros, goalAction }: DayStatsCardProps) => {
	const { t } = useTranslation()
	const goalStat = (
		<SideStatContent value={goal === null ? '—' : formatInteger(goal)} label={t('gauge.goal')} />
	)

	return (
		<Surface variant="frosted" radius="panel" className="flex flex-col gap-3.5 p-4">
			<div className="flex items-end justify-between">
				<div className={STAT_CLASS}>
					{goal !== null && (
						<SideStatContent value={formatInteger(eaten)} label={t('gauge.eaten')} />
					)}
				</div>
				<CalorieGauge eaten={eaten} goal={goal} size="large" />
				{goalAction ? (
					<button
						type="button"
						aria-haspopup="dialog"
						onClick={goalAction.onClick}
						className={cn(STAT_CLASS, 'min-h-tap cursor-pointer rounded-tile')}
					>
						{goalStat}
						{/* «2 200 ціль» stays readable; this only names the action */}
						<span className="sr-only">{goalAction.label}</span>
					</button>
				) : (
					<div className={STAT_CLASS}>{goalStat}</div>
				)}
			</div>
			<MacroTiles macros={macros} variant="bar" />
		</Surface>
	)
}
