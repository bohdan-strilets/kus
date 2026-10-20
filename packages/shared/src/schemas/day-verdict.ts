import { z } from 'zod'

/**
 * The calorie ring's bands (design: the 97–103 % band counts as the goal closed). From this share
 * of the goal up a day is on goal.
 */
export const DAY_ON_GOAL_FROM_RATIO = 0.97
/** Above this share of the goal a day is over it — the ring's «over» and the strip's over dot. */
export const DAY_OVER_GOAL_RATIO = 1.03
/** Below this share the day says nothing about the goal: shown with numbers only, never judged. */
export const DAY_FAR_UNDER_GOAL_RATIO = 0.6

/**
 * on_goal — 97–103 % of the goal (both ends included), like the ring; over / under — beyond it;
 * far_under — below 60 %, so far below that the client shows the numbers without any assessment; no_goal — no goal in force that day;
 * empty — nothing logged.
 */
export const dayVerdictSchema = z.enum([
	'on_goal',
	'over',
	'under',
	'far_under',
	'no_goal',
	'empty',
])

export type DayVerdict = z.infer<typeof dayVerdictSchema>

export const getDayVerdict = ({
	kcal,
	entryCount,
	goalKcal,
}: {
	kcal: number
	entryCount: number
	goalKcal: number | null
}): DayVerdict => {
	if (entryCount === 0) return 'empty'
	if (goalKcal === null || goalKcal <= 0) return 'no_goal'
	const ratio = kcal / goalKcal
	if (ratio > DAY_OVER_GOAL_RATIO) return 'over'
	if (ratio >= DAY_ON_GOAL_FROM_RATIO) return 'on_goal'
	if (ratio >= DAY_FAR_UNDER_GOAL_RATIO) return 'under'
	return 'far_under'
}
