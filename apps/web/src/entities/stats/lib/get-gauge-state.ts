import { DAY_OVER_GOAL_RATIO } from '@kus/shared'

/** design/docs/components.md → CalorieRing: the 97–103 % band counts as «goal closed». */
const CLOSED_FROM = 0.97
const CLOSED_TO = DAY_OVER_GOAL_RATIO
/** The second, over-goal turn stops growing at +50 % (half the arc) — then only the number talks. */
const MAX_OVER_RATIO = 0.5

export type GaugeStatus = 'under' | 'closed' | 'over'

export interface GaugeState {
	status: GaugeStatus
	/** 0…1 of the success arc. */
	fillRatio: number
	/** 0…0.5 of the over arc drawn from the start on top of the full success arc. */
	overRatio: number
	/** kcal left to the goal (0 once closed or over). */
	remaining: number
	/** kcal over the goal (0 unless over). */
	over: number
}

export const getGaugeState = (eaten: number, goal: number): GaugeState => {
	if (goal <= 0) return { status: 'under', fillRatio: 0, overRatio: 0, remaining: 0, over: 0 }

	const eatenSafe = Math.max(0, eaten)
	const ratio = eatenSafe / goal
	if (ratio > CLOSED_TO) {
		return {
			status: 'over',
			fillRatio: 1,
			overRatio: Math.min(MAX_OVER_RATIO, ratio - 1),
			remaining: 0,
			over: Math.round(eatenSafe - goal),
		}
	}
	if (ratio >= CLOSED_FROM) {
		return { status: 'closed', fillRatio: 1, overRatio: 0, remaining: 0, over: 0 }
	}
	return {
		status: 'under',
		fillRatio: ratio,
		overRatio: 0,
		remaining: Math.round(goal - eatenSafe),
		over: 0,
	}
}
