import { z } from 'zod'

import { foodSourceSchema } from './enums.js'

/** Fat is the densest macro (~9 kcal/g); anything above this is an AI or input error. */
export const MAX_KCAL_PER_GRAM = 9.5
export const MAX_ENTRY_GRAMS = 5000

/** Sources the AI may report; MANUAL is set only by the backend when the user types values in. */
export const aiFoodSourceSchema = foodSourceSchema.exclude(['MANUAL'])

export type AiFoodSource = z.infer<typeof aiFoodSourceSchema>

export const foodEntrySchema = z
	.object({
		name: z.string().trim().min(1).max(200),
		grams: z.number().positive().max(MAX_ENTRY_GRAMS),
		kcal: z.number().nonnegative(),
		protein: z.number().nonnegative(),
		fat: z.number().nonnegative(),
		carbs: z.number().nonnegative(),
		source: aiFoodSourceSchema,
		confidence: z.number().min(0).max(1),
		assumption: z.string().trim().max(500).nullable(),
	})
	.refine((entry) => entry.kcal / entry.grams <= MAX_KCAL_PER_GRAM, {
		path: ['kcal'],
		message: 'KCAL_DENSITY_TOO_HIGH',
	})

export type FoodEntry = z.infer<typeof foodEntrySchema>
