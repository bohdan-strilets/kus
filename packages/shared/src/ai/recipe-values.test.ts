import { describe, expect, it } from 'vitest'

import {
	getCookedGrams,
	getRecipeKcalPerGram,
	getRecipePortionValues,
	getRecipeTotals,
	isRecipeDensityValid,
} from './recipe-values.js'

const INGREDIENTS = [
	{ grams: 600, kcal: 600, protein: 40, fat: 30, carbs: 40 },
	{ grams: 310, kcal: 290, protein: 10, fat: 10, carbs: 50 },
]

describe('recipe values', () => {
	it('sums kcal and macros', () => {
		expect(getRecipeTotals(INGREDIENTS)).toEqual({ kcal: 890, protein: 50, fat: 40, carbs: 90 })
	})

	it('adds the water to the ingredients weight', () => {
		const recipe = { ingredients: INGREDIENTS, waterMl: 3000 }

		expect(getCookedGrams(recipe)).toBe(3910)
		expect(getRecipeKcalPerGram(recipe) * 100).toBeCloseTo(22.8, 1)
	})

	it('scales a portion by its weight', () => {
		const recipe = { ingredients: INGREDIENTS, waterMl: 3000 }

		expect(getRecipePortionValues(recipe, 850).kcal).toBeCloseTo(193.5, 0)
		expect(getRecipePortionValues(recipe, 500).kcal).toBeCloseTo(113.8, 0)
	})

	it('lets the stated cooked weight win over the water', () => {
		expect(getCookedGrams({ ingredients: INGREDIENTS, waterMl: 3000, cookedGrams: 2000 })).toBe(
			2000,
		)
	})

	it('falls back to servings times portion, then to the ingredients weight', () => {
		expect(getCookedGrams({ ingredients: INGREDIENTS, servings: 4, portionGrams: 300 })).toBe(1200)
		expect(getCookedGrams({ ingredients: INGREDIENTS })).toBe(910)
	})

	it('rejects a density above 9.5 kcal/g', () => {
		const dense = { ingredients: [{ grams: 100, kcal: 960, protein: 0, fat: 100, carbs: 0 }] }

		expect(isRecipeDensityValid(dense)).toBe(false)
		expect(isRecipeDensityValid({ ingredients: INGREDIENTS, waterMl: 3000 })).toBe(true)
	})

	it('returns zeros for an empty dish', () => {
		expect(getRecipePortionValues({ ingredients: [] }, 100).kcal).toBe(0)
	})
})
