import type { MuscleGroup, WorkoutStatsGroup } from '@kus/shared'

import { PERCENT } from './training-stats.constants'

export interface GroupRow {
	/** null: the exercise has no group («Інше»). */
	group: MuscleGroup | null
	setCount: number
	/** Bar width, % of the biggest group. */
	widthPercent: number
}

/** Strength sets per group in the order of the response, «Інше» last; bars scale to the biggest group. */
export const getGroupRows = (groups: readonly WorkoutStatsGroup[]): GroupRow[] => {
	const max = Math.max(0, ...groups.map((group) => group.setCount))
	const rows = groups.map((group) => ({
		group: group.muscleGroup,
		setCount: group.setCount,
		widthPercent: max === 0 ? 0 : Math.round((group.setCount / max) * PERCENT),
	}))
	return [...rows.filter((row) => row.group !== null), ...rows.filter((row) => row.group === null)]
}
