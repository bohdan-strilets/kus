import { z } from 'zod'

/** Fat is the densest macro (~9 kcal/g); anything above this is an AI or input error. */
export const MAX_KCAL_PER_GRAM = 9.5
export const MAX_ENTRY_GRAMS = 5000

export const foodEntrySourceSchema = z.enum(['label', 'memory', 'reference', 'estimate'])

export type FoodEntrySource = z.infer<typeof foodEntrySourceSchema>

export const foodEntrySchema = z
	.object({
		name: z.string().trim().min(1).max(200),
		grams: z.number().positive().max(MAX_ENTRY_GRAMS),
		kcal: z.number().nonnegative(),
		protein: z.number().nonnegative(),
		fat: z.number().nonnegative(),
		carbs: z.number().nonnegative(),
		source: foodEntrySourceSchema,
		confidence: z.number().min(0).max(1),
		assumption: z.string().trim().max(500).nullable(),
	})
	.refine((entry) => entry.kcal / entry.grams <= MAX_KCAL_PER_GRAM, {
		path: ['kcal'],
		message: 'KCAL_DENSITY_TOO_HIGH',
	})

export type FoodEntry = z.infer<typeof foodEntrySchema>
