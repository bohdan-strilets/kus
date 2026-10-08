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
	/** Under the gauge, outside the link: «Задати ціль» while there is no goal. */
	footer?: ReactNode
}

/**
 * docs DaySummaryCard under the chat header (mockups/chat.html): the compact half-ring and the
 * three compact macro tiles; a tap opens «Сьогодні». The footer is its own control, not a part of
 * the link (no button inside a link).
 */
export const DaySummaryCard = ({ eaten, goal, macros, footer }: DaySummaryCardProps) => (
	<Surface variant="translucent" className="flex flex-col">
		<Link
			to={ROUTES.today}
			className={cn(
				'flex items-center gap-3.5 rounded-card px-4 pt-3.5 text-ink',
				footer ? 'pb-0' : 'pb-3.5',
			)}
		>
			<CalorieGauge eaten={eaten} goal={goal} size="compact" />
			<MacroTiles macros={macros} variant="compact" className="min-w-0 flex-1" />
		</Link>
		{footer && <div className="px-4 pb-1">{footer}</div>}
	</Surface>
)
