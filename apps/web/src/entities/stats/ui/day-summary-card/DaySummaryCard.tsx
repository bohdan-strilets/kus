import { Link } from 'react-router'

import { ROUTES } from '@/shared/config'

import type { MacroProgressSet } from '../../model/macro.types'
import { CalorieGauge } from '../calorie-gauge/CalorieGauge'
import { MacroTiles } from '../macro-tiles/MacroTiles'

export interface DaySummaryCardProps {
	eaten: number
	goal: number
	macros: MacroProgressSet
}

/**
 * docs DaySummaryCard under the chat header (mockups/chat.html): the compact half-ring and the
 * three compact macro tiles; a tap opens «Сьогодні».
 */
export const DaySummaryCard = ({ eaten, goal, macros }: DaySummaryCardProps) => (
	<Link
		to={ROUTES.today}
		className="flex items-center gap-3.5 rounded-card bg-surface/82 px-4 py-3.5 text-ink shadow-card"
	>
		<CalorieGauge eaten={eaten} goal={goal} size="compact" />
		<MacroTiles macros={macros} variant="compact" className="min-w-0 flex-1" />
	</Link>
)
