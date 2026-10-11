import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@/shared/config'
import { cn } from '@/shared/lib'
import { Surface } from '@/shared/ui'

import type { MacroProgressSet } from '../../model/macro.types'
import { CalorieGauge } from '../calorie-gauge/CalorieGauge'
import { MacroTiles } from '../macro-tiles/MacroTiles'

export interface DaySummaryCardProps {
	eaten: number
	goal: number | null
	macros: MacroProgressSet
	/** A tap on «з'їдено / ціль» — the goal sheet; the macro tiles still open «Сьогодні». */
	goalAction?: { label: string; onClick: () => void }
	/** Under the gauge, outside the link: «Задати ціль» while there is no goal. */
	footer?: ReactNode
}

/**
 * docs DaySummaryCard under the chat header (mockups/chat.html): the compact half-ring and the
 * three compact macro tiles; a tap opens «Сьогодні». With a goal action the half-ring is its own
 * button (no button inside a link), like the footer.
 */
export const DaySummaryCard = ({
	eaten,
	goal,
	macros,
	goalAction,
	footer,
}: DaySummaryCardProps) => {
	const gauge = <CalorieGauge eaten={eaten} goal={goal} size="compact" />
	const tiles = <MacroTiles macros={macros} variant="compact" className="min-w-0 flex-1" />
	const rowClass = cn('flex items-center gap-3.5 px-4 pt-3.5', footer ? 'pb-0' : 'pb-3.5')

	return (
		<Surface variant="translucent" className="flex flex-col">
			{goalAction ? (
				<div className={rowClass}>
					<button
						type="button"
						aria-haspopup="dialog"
						onClick={goalAction.onClick}
						className="cursor-pointer rounded-tile text-ink"
					>
						{gauge}
						{/* the gauge keeps its own label with the numbers; this only names the action */}
						<span className="sr-only">{goalAction.label}</span>
					</button>
					<Link to={ROUTES.today} replace className="flex min-w-0 flex-1 rounded-tile text-ink">
						{tiles}
					</Link>
				</div>
			) : (
				<Link to={ROUTES.today} replace className={cn(rowClass, 'rounded-card text-ink')}>
					{gauge}
					{tiles}
				</Link>
			)}
			{footer && <div className="px-4 pb-1">{footer}</div>}
		</Surface>
	)
}
