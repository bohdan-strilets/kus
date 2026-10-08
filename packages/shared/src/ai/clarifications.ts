// Which clarify questions are worth asking: the backend decides, not the model.
import { isMacrosConsistent, MAX_KCAL_PER_GRAM } from '../schemas/food-entry.js'
import { distributeOptionValues } from './option-values.js'
import type { ClarifyInput, LogFoodInput } from './tools.js'

/** Drinks with ethanol never add up from macros (see food-entry.ts). */
const ALCOHOL_CATEGORY = 'alcohol'

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

/**
 * An option is judged like the items it replaces: kcal per gram (its own grams, else the items')
 * and kcal against macros — with the alcohol exemption and the wider label band of those items.
 * Indexes must already be in range.
 */
export const getClarifyOptionErrors = (log: LogFoodInput, clarify: ClarifyInput): string[] => {
	const items = clarify.itemIndexes.flatMap((index) => log.items[index] ?? [])
	const itemsGrams = items.reduce((sum, item) => sum + item.grams, 0)
	const category = items.find((item) => item.category === ALCOHOL_CATEGORY)?.category ?? 'plate'
	const source = items.every((item) => item.source === 'LABEL') ? 'LABEL' : 'ESTIMATE'
	return clarify.options.flatMap((option, index) => {
		const errors: string[] = []
		const grams = option.grams ?? itemsGrams
		if (grams > 0 && option.kcal / grams > MAX_KCAL_PER_GRAM) {
			errors.push(`clarify: options.${index}.kcal is above ${MAX_KCAL_PER_GRAM} kcal per gram`)
		}
		if (!isMacrosConsistent({ ...option, category, source })) {
			errors.push(
				`clarify: options.${index}.kcal does not match 4·protein + 4·carbs + 9·fat + 2·fiber`,
			)
		}
		// a tap splits the totals by the items' current kcal: each share must still be a valid entry
		if (errors.length === 0 && items.length > 1 && !distributeOptionValues(items, option)) {
			errors.push(
				`clarify: options.${index} split over items by their kcal makes an item denser than ${MAX_KCAL_PER_GRAM} kcal/g — ask about one item, or keep the items' kcal shares`,
			)
		}
		return errors
	})
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
