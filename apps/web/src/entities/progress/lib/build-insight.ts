import type { GoalType, ProgressInsight } from '@kus/shared'
import type { TFunction } from 'i18next'

import {
	formatPaceSentence,
	getPaceSentenceKey,
	type PaceSentenceKey,
} from '@/entities/measurement'

export type InsightPart =
	| { key: PaceSentenceKey; kg: number }
	| { key: 'progress.insight.overDays'; count: number }
	| { key: 'progress.insight.weekendProtein' }

const isAlongGoal = (goalType: GoalType | null, weekPaceKg: number): boolean =>
	(goalType === 'LOSE' && weekPaceKg < 0) || (goalType === 'GAIN' && weekPaceKg > 0)

/**
 * Which short sentences the hamster says, at most three, and only for facts that are there. The
 * sentence texts are i18n templates; the model is not involved and no number is invented. The pace
 * is compared with the plan only when the week moved the way the goal points.
 */
export const getInsightKeys = (insight: ProgressInsight): InsightPart[] => {
	const parts: InsightPart[] = []
	const { weekPaceKg, planPaceKgPerWeek, goalType } = insight
	const paceKey = getPaceSentenceKey({
		kind: 'WEIGHT',
		weekChange: weekPaceKg,
		planPaceKgPerWeek,
		isAlongPlan: weekPaceKg !== null && isAlongGoal(goalType, weekPaceKg),
	})
	if (paceKey !== null && weekPaceKg !== null) {
		parts.push({ key: paceKey, kg: Math.abs(weekPaceKg) })
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
		return formatPaceSentence(t, part.key, part.kg, 'WEIGHT')
	})
