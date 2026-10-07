import { describe, expect, it } from 'vitest'

import { foodEntrySchema } from './food-entry.js'

const validEntry = {
	name: 'Вівсянка на молоці',
	grams: 250,
	kcal: 310,
	protein: 11,
	fat: 9,
	carbs: 45,
	category: 'porridge',
	source: 'ESTIMATE',
	confidence: 0.7,
	assumption: 'Молоко 2.5%',
}

const getIssueMessages = (input: unknown): string[] => {
	const result = foodEntrySchema.safeParse(input)
	return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('foodEntrySchema', () => {
	it('accepts a valid entry and fills optional fields with null', () => {
		const entry = foodEntrySchema.parse(validEntry)
		expect(entry.fiber).toBeNull()
		expect(entry.quantity).toBeNull()
		expect(entry.memoryRef).toBeNull()
	})

	it('rejects energy density above 9.5 kcal/g', () => {
		// fat-only so the macros still add up and only the density check fires
		const pureFat = { ...validEntry, grams: 10, kcal: 100, protein: 0, carbs: 0, fat: 11.1 }
		expect(getIssueMessages(pureFat)).toEqual(['KCAL_DENSITY_TOO_HIGH'])
	})

	it('rejects weight above 5000 g and below 1 g', () => {
		expect(foodEntrySchema.safeParse({ ...validEntry, grams: 5001 }).success).toBe(false)
		expect(foodEntrySchema.safeParse({ ...validEntry, grams: 0.5 }).success).toBe(false)
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

	it('falls back to plate for an unknown category', () => {
		expect(foodEntrySchema.parse({ ...validEntry, category: 'spaghetti' }).category).toBe('plate')
	})

	it('rejects a memory ref that is not a context ref', () => {
		const withDbId = { ...validEntry, memoryRef: '01999a00-0000-7000-8000-000000000001' }
		expect(foodEntrySchema.safeParse(withDbId).success).toBe(false)
	})
})

describe('foodEntrySchema macros consistency', () => {
	// 4·10 + 4·20 + 9·10 = 210 kcal from macros
	const macros = { protein: 10, carbs: 20, fat: 10 }

	it('rejects an estimate whose kcal is ~20 % off the macros', () => {
		const entry = { ...validEntry, ...macros, kcal: 252 }
		expect(getIssueMessages(entry)).toEqual(['MACROS_KCAL_MISMATCH'])
	})

	it('accepts the same ~20 % gap on a label: its kcal wins over manufacturer rounding', () => {
		const entry = { ...validEntry, ...macros, kcal: 252, source: 'LABEL' }
		expect(foodEntrySchema.safeParse(entry).success).toBe(true)
	})

	it('rejects a label far off its macros', () => {
		const entry = { ...validEntry, ...macros, kcal: 320, source: 'LABEL' }
		expect(getIssueMessages(entry)).toEqual(['MACROS_KCAL_MISMATCH'])
	})

	it('counts fiber at 2 kcal/g', () => {
		// 210 + 2·25 = 260; without fiber 260 would be 24 % off
		const entry = { ...validEntry, ...macros, fiber: 25, kcal: 260 }
		expect(foodEntrySchema.safeParse(entry).success).toBe(true)
	})

	it('allows a 15 kcal absolute gap on small items', () => {
		const coffee = { ...validEntry, grams: 200, kcal: 15, protein: 0, carbs: 0, fat: 0 }
		expect(foodEntrySchema.safeParse(coffee).success).toBe(true)
	})

	it('skips the check for alcohol', () => {
		// 500 ml beer: ~215 kcal, mostly ethanol
		const beer = { ...validEntry, grams: 500, kcal: 215, protein: 2.5, carbs: 18, fat: 0 }
		expect(foodEntrySchema.safeParse({ ...beer, category: 'alcohol' }).success).toBe(true)
		expect(foodEntrySchema.safeParse({ ...beer, category: 'juice' }).success).toBe(false)
	})
})
