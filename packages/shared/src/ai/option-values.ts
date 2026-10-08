// How a tapped clarify answer re-logs its entries. Shared: the parser rejects an answer this split
// would break, so a tap never fails on what the model was allowed to send.
import { MAX_ENTRY_GRAMS, MAX_KCAL_PER_GRAM, MIN_ENTRY_GRAMS } from '../schemas/food-entry.js'
import type { ClarifyOption } from './tools.js'

const DECIMALS = 10

/** One decimal, like every stored nutrition value. */
const roundNutrition = (value: number): number => Math.round(value * DECIMALS) / DECIMALS

export interface EntryValues {
	grams: number
	kcal: number
	protein: number
	fat: number
	carbs: number
	fiber: number | null
}

const isValid = ({ grams, kcal }: EntryValues): boolean =>
	grams >= MIN_ENTRY_GRAMS && grams <= MAX_ENTRY_GRAMS && kcal / grams <= MAX_KCAL_PER_GRAM

const getShares = (values: number[]): number[] => {
	const total = values.reduce((sum, value) => sum + value, 0)
	// nothing to weigh by: split evenly
	return values.map((value) => (total > 0 ? value / total : 1 / values.length))
}

/**
 * The answer's totals spread over the entries it is about: a single entry takes them as they are;
 * several split them by their current kcal (grams by their current grams, and only if the answer
 * changes the weight). `null` if a share would break the entry limits — the answer can't apply.
 */
export const distributeOptionValues = (
	entries: readonly EntryValues[],
	option: ClarifyOption,
): EntryValues[] | null => {
	if (entries.length === 0) return null
	const kcalShares = getShares(entries.map((entry) => entry.kcal))
	const gramShares = getShares(entries.map((entry) => entry.grams))
	const result = entries.map((entry, index) => {
		const share = kcalShares[index] ?? 0
		const gramShare = gramShares[index] ?? 0
		return {
			grams: roundNutrition(option.grams === null ? entry.grams : option.grams * gramShare),
			kcal: roundNutrition(option.kcal * share),
			protein: roundNutrition(option.protein * share),
			fat: roundNutrition(option.fat * share),
			carbs: roundNutrition(option.carbs * share),
			fiber: option.fiber === null ? null : roundNutrition(option.fiber * share),
		}
	})
	return result.every(isValid) ? result : null
}
