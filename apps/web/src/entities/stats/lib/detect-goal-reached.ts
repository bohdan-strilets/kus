import type { GaugeStatus } from './get-gauge-state'

interface DetectGoalReachedParams {
	/** null: the first observation of the day in this session. */
	previousStatus: GaugeStatus | null
	nextStatus: GaugeStatus
	hasGoal: boolean
	/** A local action that changed the food has just succeeded. */
	isArmed: boolean
	localDate: string
	today: string
}

/**
 * «The goal just closed» — only the under → closed step, caused by the user's own action today.
 * A first observation (null) is a page load or a sync from another device: never celebrated.
 */
export const detectGoalReached = ({
	previousStatus,
	nextStatus,
	hasGoal,
	isArmed,
	localDate,
	today,
}: DetectGoalReachedParams): boolean =>
	previousStatus === 'under' && nextStatus === 'closed' && hasGoal && isArmed && localDate === today
