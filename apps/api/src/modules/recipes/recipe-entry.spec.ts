import type { RecipeBody } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { toPotEntry, toSavedRecipeEntry } from './recipe-entry'
import { RecipePortionInvalidException } from './recipes.exceptions'
import type { RecipeWithIngredients } from './recipes.repository'

const POT_ID = '0190f3a0-0000-7000-8000-0000000000aa'

/** 910 g of ingredients, 890 kcal, with 3000 ml of water: 3910 g, ≈ 22.8 kcal/100 g. */
const body: RecipeBody = {
	ingredients: [
		{ name: 'Філе', grams: 410, kcal: 450, protein: 90, fat: 6, carbs: 0, fiber: null },
		{ name: 'Картопля', grams: 500, kcal: 440, protein: 10, fat: 1, carbs: 100, fiber: null },
	],
	waterMl: 3000,
	cookedGrams: null,
	servings: null,
}

describe('toPotEntry', () => {
	it('counts the portion from the composition, keeps the draft and the pot id', () => {
		const entry = toPotEntry({ grams: 850 }, body, POT_ID)

		expect(entry.kcal).toBeCloseTo(193.5, 0)
		expect(entry.source).toBe('ESTIMATE')
		expect(entry.potId).toBe(POT_ID)
		expect(entry.recipeId).toBeNull()
		expect(entry.recipeDraft).toBe(body)
		expect(entry.fiber).toBeNull()
	})

	it('a portion of another size takes the same density', () => {
		const half = toPotEntry({ grams: 425 }, body, POT_ID)
		const whole = toPotEntry({ grams: 850 }, body, POT_ID)

		expect(half.kcal * 2).toBeCloseTo(whole.kcal, 5)
	})

	it('stores the weight a pot told by its plates implies', () => {
		const entry = toPotEntry({ grams: 350 }, { ...body, waterMl: null, servings: 6 }, POT_ID)

		expect(entry.recipeDraft?.cookedGrams).toBe(2100)
	})

	it('rejects a portion over 5000 g and a pot denser than 9.5 kcal/g', () => {
		expect(() => toPotEntry({ grams: 5001 }, { ...body, waterMl: 20000 }, POT_ID)).toThrow(
			RecipePortionInvalidException,
		)
		expect(() => toPotEntry({ grams: 100 }, { ...body, cookedGrams: 50 }, POT_ID)).toThrow(
			RecipePortionInvalidException,
		)
	})
})

const recipe = {
	id: 'recipe-1',
	cookedGrams: 1000,
	defaultGrams: 350,
	ingredients: [
		{ grams: 500, kcal: 600, proteinG: 20, fatG: 10, carbsG: 100 },
		{ grams: 500, kcal: 400, proteinG: 60, fatG: 20, carbsG: 0 },
	],
} as RecipeWithIngredients

describe('toSavedRecipeEntry', () => {
	it('scales the recipe to the grams, links it and starts no new pot', () => {
		const entry = toSavedRecipeEntry(recipe, 350)

		expect(entry).toMatchObject({
			kcal: 350,
			protein: 28,
			recipeId: 'recipe-1',
			potId: null,
			source: 'MEMORY',
			myFoodId: null,
		})
		expect(entry.recipeDraft).toBeUndefined()
	})

	it('rejects a portion over 5000 g', () => {
		expect(() => toSavedRecipeEntry(recipe, 5001)).toThrow(RecipePortionInvalidException)
	})
})
