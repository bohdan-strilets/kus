import { describe, expect, it } from 'vitest'

import { isLiquidCategory } from './food-units.js'

describe('isLiquidCategory', () => {
	it('counts drinks and liquid dairy in ml', () => {
		for (const category of [
			'coffee',
			'tea',
			'juice',
			'soda',
			'alcohol',
			'milk',
			'protein_shake',
		] as const) {
			expect(isLiquidCategory(category)).toBe(true)
		}
	})

	it('keeps food, yogurt and soup in grams', () => {
		for (const category of ['yogurt', 'soup', 'borscht', 'porridge', 'plate'] as const) {
			expect(isLiquidCategory(category)).toBe(false)
		}
	})
})
