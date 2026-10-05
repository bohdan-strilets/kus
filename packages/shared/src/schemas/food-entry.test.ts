import { describe, expect, it } from 'vitest'

import { foodEntrySchema } from './food-entry.js'

const validEntry = {
	name: 'Вівсянка на молоці',
	grams: 250,
	kcal: 310,
	protein: 11,
	fat: 9,
	carbs: 45,
	source: 'ESTIMATE',
	confidence: 0.7,
	assumption: 'Молоко 2.5%',
}

describe('foodEntrySchema', () => {
	it('accepts a valid entry', () => {
		expect(foodEntrySchema.safeParse(validEntry).success).toBe(true)
	})

	it('rejects energy density above 9.5 kcal/g', () => {
		const result = foodEntrySchema.safeParse({ ...validEntry, grams: 10, kcal: 100 })
		expect(result.success).toBe(false)
	})

	it('rejects weight above 5000 g', () => {
		expect(foodEntrySchema.safeParse({ ...validEntry, grams: 5001 }).success).toBe(false)
	})

	it('rejects MANUAL source — only the backend sets it', () => {
		expect(foodEntrySchema.safeParse({ ...validEntry, source: 'MANUAL' }).success).toBe(false)
	})

	it('rejects lowercase source values', () => {
		expect(foodEntrySchema.safeParse({ ...validEntry, source: 'estimate' }).success).toBe(false)
	})

	it('rejects negative macros', () => {
		expect(foodEntrySchema.safeParse({ ...validEntry, fat: -1 }).success).toBe(false)
	})
})
