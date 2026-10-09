import { z } from 'zod'

import { loggableMealTypeSchema } from '../ai/tools.js'
import { MAX_ENTRY_GRAMS, MIN_ENTRY_GRAMS } from './food-entry.js'

/** `:id` of PATCH / DELETE /food-entries/:id. */
export const foodEntryParamsSchema = z.object({ id: z.uuid() })

export type FoodEntryParams = z.infer<typeof foodEntryParamsSchema>

/**
 * Body of PATCH /food-entries/:id — the edit sheet, no model involved: a new weight of the whole
 * portion (kcal and macros follow by density) and/or another meal of the same day.
 */
export const updateFoodEntryRequestSchema = z
	.object({
		grams: z.number().min(MIN_ENTRY_GRAMS).max(MAX_ENTRY_GRAMS).optional(),
		mealType: loggableMealTypeSchema.optional(),
	})
	.refine((body) => body.grams !== undefined || body.mealType !== undefined, {
		message: 'NOTHING_TO_CHANGE',
	})

export type UpdateFoodEntryRequest = z.infer<typeof updateFoodEntryRequestSchema>
