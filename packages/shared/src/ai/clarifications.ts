// Which clarify questions are worth asking: the backend decides, not the model.
import type { ClarifyInput, LogFoodInput } from './tools.js'

/** A clarify question is worth asking only above both thresholds (CLAUDE.md §6). */
export const CLARIFY_MIN_IMPACT_KCAL = 80
export const CLARIFY_MIN_IMPACT_SHARE = 0.15
export const MAX_CLARIFICATIONS_PER_MESSAGE = 2

/**
 * A message spanning several meals (a whole day written at once) gets at most one question, and
 * only a big one: a quiz about yesterday is worse than a fair estimate with a short assumption.
 */
export const MULTI_MEAL_MIN_IMPACT_KCAL = 150
export const MULTI_MEAL_MAX_CLARIFICATIONS = 1

export interface ClarificationResult extends ClarifyInput {
	/** max(option kcal) − min(option kcal), computed here, not by the model. */
	impactKcal: number
}

const getImpactKcal = (clarify: ClarifyInput): number => {
	const values = clarify.options.map((option) => option.kcal)
	return Math.max(...values) - Math.min(...values)
}

/** Items name their meal, else the message-level one; null (by the clock) counts as one more meal. */
export const isMultiMealLog = (log: LogFoodInput): boolean =>
	new Set(log.items.map((item) => item.mealType ?? log.mealType)).size > 1

/** Drops questions below the thresholds and keeps the largest ones, fewer for several meals. */
export const filterClarifications = (
	log: LogFoodInput,
	clarifications: ClarifyInput[],
): ClarificationResult[] => {
	const isMultiMeal = isMultiMealLog(log)
	const minImpactKcal = isMultiMeal ? MULTI_MEAL_MIN_IMPACT_KCAL : CLARIFY_MIN_IMPACT_KCAL
	const maxCount = isMultiMeal ? MULTI_MEAL_MAX_CLARIFICATIONS : MAX_CLARIFICATIONS_PER_MESSAGE
	return clarifications
		.map((clarify) => ({ ...clarify, impactKcal: getImpactKcal(clarify) }))
		.filter((clarify) => {
			const itemsKcal = clarify.itemIndexes.reduce(
				(sum, index) => sum + (log.items[index]?.kcal ?? 0),
				0,
			)
			return (
				clarify.impactKcal >= minImpactKcal &&
				clarify.impactKcal >= itemsKcal * CLARIFY_MIN_IMPACT_SHARE
			)
		})
		.sort((a, b) => b.impactKcal - a.impactKcal)
		.slice(0, maxCount)
}
