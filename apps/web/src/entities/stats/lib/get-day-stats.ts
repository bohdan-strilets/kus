import type { DayResponse } from '@kus/shared'

import type { MacroProgressSet } from '../model/macro.types'

export interface DayStats {
	eaten: number
	/** null without a goal: rings and tiles show only what was eaten. */
	goal: number | null
	macros: MacroProgressSet
}

type MacroTotals = Pick<DayResponse['totals'], 'kcal' | 'protein' | 'carbs' | 'fat'>

/** What the gauges need from GET /days/:localDate or a chat day card; the numbers are the backend's sums. */
export const getDayStats = ({
	totals,
	goal,
}: {
	totals: MacroTotals
	goal: MacroTotals | null
}): DayStats => ({
	eaten: totals.kcal,
	goal: goal?.kcal ?? null,
	macros: {
		protein: { value: totals.protein, goal: goal?.protein ?? null },
		carbs: { value: totals.carbs, goal: goal?.carbs ?? null },
		fat: { value: totals.fat, goal: goal?.fat ?? null },
	},
})
