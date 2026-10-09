import { describe, expect, it } from 'vitest'

import { updateFoodEntryRequestSchema } from './food-entries.js'

describe('updateFoodEntryRequestSchema', () => {
	it('accepts a weight, a meal, or both', () => {
		expect(updateFoodEntryRequestSchema.parse({ grams: 150 })).toEqual({ grams: 150 })
		expect(updateFoodEntryRequestSchema.parse({ mealType: 'DINNER' })).toEqual({
			mealType: 'DINNER',
		})
		expect(updateFoodEntryRequestSchema.parse({ grams: 80, mealType: 'SNACK' })).toEqual({
			grams: 80,
			mealType: 'SNACK',
		})
	})

	it('needs at least one change', () => {
		const result = updateFoodEntryRequestSchema.safeParse({})
		expect(result.success).toBe(false)
		if (result.success) return
		expect(result.error.issues.map((issue) => issue.message)).toEqual(['NOTHING_TO_CHANGE'])
	})

	it('keeps the entry limits and never logs into OTHER', () => {
		expect(updateFoodEntryRequestSchema.safeParse({ grams: 0 }).success).toBe(false)
		expect(updateFoodEntryRequestSchema.safeParse({ grams: 5001 }).success).toBe(false)
		expect(updateFoodEntryRequestSchema.safeParse({ mealType: 'OTHER' }).success).toBe(false)
	})
})
