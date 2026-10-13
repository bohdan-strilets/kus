import type { GoalType, ProgressInsight } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatMeasurement } from '@/entities/measurement'

/** Within this many kg of the plan a week counts as «якраз за планом». */
export const PLAN_PACE_TOLERANCE_KG = 0.1
/** A week moved by less than this is no change. */
export const STEADY_PACE_KG = 0.05

type PlanComparison = 'plain' | 'onPlan' | 'faster' | 'slower'

export type PaceInsightKey =
	'progress.insight.pace.steady' | `progress.insight.pace.${'down' | 'up'}.${PlanComparison}`

export type InsightPart =
	| { key: PaceInsightKey; kg: number }
	| { key: 'progress.insight.overDays'; count: number }
	| { key: 'progress.insight.weekendProtein' }

const isAlongGoal = (goalType: GoalType | null, weekPaceKg: number): boolean =>
	(goalType === 'LOSE' && weekPaceKg < 0) || (goalType === 'GAIN' && weekPaceKg > 0)

const compareWithPlan = (weekPaceKg: number, plan: number): PlanComparison => {
	const difference = Math.abs(weekPaceKg) - plan
	if (Math.abs(difference) <= PLAN_PACE_TOLERANCE_KG) return 'onPlan'
	return difference > 0 ? 'faster' : 'slower'
}

/**
 * The pace is compared with the plan only when the week moved the way the goal points: against
 * it, or with no direction (maintain, no goal), it is a plain fact. Never praise, never blame.
 */
const getPaceKey = ({
	weekPaceKg,
	planPaceKgPerWeek,
	goalType,
}: ProgressInsight): PaceInsightKey | null => {
	if (weekPaceKg === null) return null
	if (Math.abs(weekPaceKg) < STEADY_PACE_KG) return 'progress.insight.pace.steady'
	const direction = weekPaceKg < 0 ? 'down' : 'up'
	const comparison: PlanComparison =
		planPaceKgPerWeek !== null && isAlongGoal(goalType, weekPaceKg)
			? compareWithPlan(weekPaceKg, planPaceKgPerWeek)
			: 'plain'
	return `progress.insight.pace.${direction}.${comparison}`
}

/**
 * Which short sentences the hamster says, at most three, and only for facts that are there. The
 * sentence texts are i18n templates; the model is not involved and no number is invented.
 */
export const getInsightKeys = (insight: ProgressInsight): InsightPart[] => {
	const parts: InsightPart[] = []
	const paceKey = getPaceKey(insight)
	if (paceKey !== null && insight.weekPaceKg !== null) {
		parts.push({ key: paceKey, kg: Math.abs(insight.weekPaceKg) })
	}
	if (insight.overDays > 0)
		parts.push({ key: 'progress.insight.overDays', count: insight.overDays })
	if (insight.isWeekendProteinLow) parts.push({ key: 'progress.insight.weekendProtein' })
	return parts
}

/** The sentences, translated; an empty list when there is nothing to say. */
export const buildInsight = (insight: ProgressInsight, t: TFunction): string[] =>
	getInsightKeys(insight).map((part) => {
		if (part.key === 'progress.insight.overDays') return t(part.key, { count: part.count })
		if (part.key === 'progress.insight.weekendProtein') return t(part.key)
		if (part.key === 'progress.insight.pace.steady') return t(part.key)
		return t(part.key, { value: formatMeasurement(part.kg, 'WEIGHT', t) })
	})
