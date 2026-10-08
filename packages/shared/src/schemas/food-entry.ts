import { z } from 'zod'

import {
	FALLBACK_FOOD_CATEGORY,
	foodCategorySchema,
	type FoodSource,
	foodSourceSchema,
} from './enums.js'

/** Fat is the densest macro (~9 kcal/g); anything above this is an AI or input error. */
export const MAX_KCAL_PER_GRAM = 9.5
export const MIN_ENTRY_GRAMS = 1
export const MAX_ENTRY_GRAMS = 5000
/** "3 eggs" — counts above this are a parsing error, not a meal. */
export const MAX_ENTRY_QUANTITY = 100

/** Atwater factors; fiber counts as ~2 kcal/g in EU labelling. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9, fiber: 2 } as const

/**
 * How far kcal may drift from the macros. Labels round each value separately and polyols
 * skew them, so a label's kcal wins within a wider band; estimates must add up tighter.
 */
export const MACROS_TOLERANCE = { default: 0.15, label: 0.3, minKcal: 15 } as const

/** Ethanol (7 kcal/g) is not a macro, so drinks with alcohol never add up from P/C/F. */
const MACROS_CHECK_EXEMPT_CATEGORIES = new Set<string>(['alcohol'])

/** Sources the AI may report; MANUAL is set only by the backend when the user types values in. */
export const aiFoodSourceSchema = foodSourceSchema.exclude(['MANUAL'])

export type AiFoodSource = z.infer<typeof aiFoodSourceSchema>

/** Refs the backend gives saved foods in the model context (`m1`…), never database ids. */
export const MEMORY_REF_PATTERN = /^m\d{1,3}$/

export const foodEntryBaseSchema = z.object({
	name: z.string().trim().min(1).max(200),
	grams: z.number().min(MIN_ENTRY_GRAMS).max(MAX_ENTRY_GRAMS),
	quantity: z.number().positive().max(MAX_ENTRY_QUANTITY).nullable().default(null),
	kcal: z.number().nonnegative(),
	protein: z.number().nonnegative(),
	fat: z.number().nonnegative(),
	carbs: z.number().nonnegative(),
	fiber: z.number().nonnegative().nullable().default(null),
	// an unknown category costs only an icon, so it falls back instead of rejecting the entry
	category: foodCategorySchema.catch(FALLBACK_FOOD_CATEGORY),
	source: aiFoodSourceSchema,
	confidence: z.number().min(0).max(1),
	assumption: z.string().trim().max(500).nullable(),
	memoryRef: z.string().regex(MEMORY_REF_PATTERN).nullable().default(null),
})

type FoodEntryBase = z.infer<typeof foodEntryBaseSchema>

interface Macros {
	protein: number
	fat: number
	carbs: number
	fiber: number | null
}

/** What the kcal ↔ macros check needs: an entry, or a clarify option judged like its items. */
export interface MacrosCheckInput extends Macros {
	kcal: number
	category: string
	source: FoodSource
}

export const getKcalFromMacros = ({ protein, fat, carbs, fiber }: Macros): number =>
	protein * KCAL_PER_GRAM.protein +
	carbs * KCAL_PER_GRAM.carbs +
	fat * KCAL_PER_GRAM.fat +
	(fiber ?? 0) * KCAL_PER_GRAM.fiber

export const isMacrosConsistent = (entry: MacrosCheckInput): boolean => {
	if (MACROS_CHECK_EXEMPT_CATEGORIES.has(entry.category)) return true
	const rate = entry.source === 'LABEL' ? MACROS_TOLERANCE.label : MACROS_TOLERANCE.default
	const tolerance = Math.max(entry.kcal * rate, MACROS_TOLERANCE.minKcal)
	return Math.abs(entry.kcal - getKcalFromMacros(entry)) <= tolerance
}

/** Cross-field checks shared by every schema built on `foodEntryBaseSchema`. */
export const refineFoodEntry = (entry: FoodEntryBase, context: z.RefinementCtx): void => {
	if (entry.kcal / entry.grams > MAX_KCAL_PER_GRAM) {
		context.addIssue({ code: 'custom', path: ['kcal'], message: 'KCAL_DENSITY_TOO_HIGH' })
	}
	if (!isMacrosConsistent(entry)) {
		context.addIssue({ code: 'custom', path: ['kcal'], message: 'MACROS_KCAL_MISMATCH' })
	}
}

export const foodEntrySchema = foodEntryBaseSchema.superRefine(refineFoodEntry)

export type FoodEntry = z.infer<typeof foodEntrySchema>
