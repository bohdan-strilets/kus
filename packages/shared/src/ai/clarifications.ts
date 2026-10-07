// Which clarify questions are worth asking: the backend decides, not the model.
import type { ClarifyInput, LogFoodInput } from './tools.js'

/** A clarify question is worth asking only above both thresholds (CLAUDE.md §6). */
export const CLARIFY_MIN_IMPACT_KCAL = 80
export const CLARIFY_MIN_IMPACT_SHARE = 0.15
export const MAX_CLARIFICATIONS_PER_MESSAGE = 2

export interface ClarificationResult extends ClarifyInput {
	/** max(option kcal) − min(option kcal), computed here, not by the model. */
	impactKcal: number
}

const getImpactKcal = (clarify: ClarifyInput): number => {
	const values = clarify.options.map((option) => option.kcal)
	return Math.max(...values) - Math.min(...values)
}

/** Drops questions below the thresholds and keeps the 2 with the largest impact. */
export const selectClarifications = (
	log: LogFoodInput,
	clarifications: ClarifyInput[],
): ClarificationResult[] =>
	clarifications
		.map((clarify) => ({ ...clarify, impactKcal: getImpactKcal(clarify) }))
		.filter((clarify) => {
			const itemsKcal = clarify.itemIndexes.reduce(
				(sum, index) => sum + (log.items[index]?.kcal ?? 0),
				0,
			)
			return (
				clarify.impactKcal >= CLARIFY_MIN_IMPACT_KCAL &&
				clarify.impactKcal >= itemsKcal * CLARIFY_MIN_IMPACT_SHARE
			)
		})
		.sort((a, b) => b.impactKcal - a.impactKcal)
		.slice(0, MAX_CLARIFICATIONS_PER_MESSAGE)
