import { describe, expect, it } from 'vitest'

import { getMealCategory } from './get-meal-category'

describe('getMealCategory', () => {
	it('takes the category of the most caloric entry', () => {
		expect(
			getMealCategory([
				{ category: 'salad', kcal: 120 },
				{ category: 'pizza', kcal: 890 },
				{ category: 'soda', kcal: 140 },
			]),
		).toBe('pizza')
	})

	it('keeps the first entry on a tie', () => {
		expect(
			getMealCategory([
				{ category: 'eggs', kcal: 200 },
				{ category: 'toast', kcal: 200 },
			]),
		).toBe('eggs')
	})

	it('falls back to the plate for an empty meal or an uncategorised top entry', () => {
		expect(getMealCategory([])).toBe('plate')
		expect(
			getMealCategory([
				{ category: null, kcal: 400 },
				{ category: 'tea', kcal: 5 },
			]),
		).toBe('plate')
	})
})
