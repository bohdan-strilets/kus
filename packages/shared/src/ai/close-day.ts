// What «close the day» logs when the user only knows the day's total («близько 1800 за день»).
import { FALLBACK_FOOD_CATEGORY, type FoodCategory } from '../schemas/enums.js'

/** An estimate above this is a typo or a joke, not a day. */
export const MAX_ESTIMATED_DAY_KCAL = 20_000

/** Name of the one entry that fills the gap up to the user's estimate; the user's language. */
export const UNDETAILED_ENTRY_NAME = 'Без деталей'
/** The reply of show_stats when nothing was logged in the period; replaces the model's text. The user's language. */
export const STATS_EMPTY_REPLY = 'За цей період ще нічого не записано.'
export const UNDETAILED_ENTRY_CONFIDENCE = 0.3
export const UNDETAILED_ENTRY_CATEGORY: FoodCategory = FALLBACK_FOOD_CATEGORY

/** Share of the entry's kcal that comes from protein / carbs / fat — a plain mixed diet. */
export const UNDETAILED_KCAL_SHARES = { protein: 0.2, carbs: 0.5, fat: 0.3 } as const

/** An average mixed food; only makes up the grams so the entry is a plausible portion. */
const UNDETAILED_KCAL_PER_GRAM = 2
const KCAL_PER_GRAM_OF = { protein: 4, carbs: 4, fat: 9 } as const

export interface UndetailedEntryValues {
	grams: number
	kcal: number
	protein: number
	fat: number
	carbs: number
}

/** Macros by a fixed proportion, so kcal ≈ 4·P + 4·C + 9·F holds; the backend rounds when saving. */
export const getUndetailedEntryValues = (kcal: number): UndetailedEntryValues => ({
	grams: Math.max(1, kcal / UNDETAILED_KCAL_PER_GRAM),
	kcal,
	protein: (kcal * UNDETAILED_KCAL_SHARES.protein) / KCAL_PER_GRAM_OF.protein,
	carbs: (kcal * UNDETAILED_KCAL_SHARES.carbs) / KCAL_PER_GRAM_OF.carbs,
	fat: (kcal * UNDETAILED_KCAL_SHARES.fat) / KCAL_PER_GRAM_OF.fat,
})
