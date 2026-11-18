import { describe, expect, it } from 'vitest'

import { recipeBodySchema, recipeDraftSchema } from './recipe-body.js'

const ingredient = { name: 'Картопля', grams: 250, kcal: 190, protein: 5, fat: 0, carbs: 42 }

const body = { ingredients: [ingredient], waterMl: 3000, cookedGrams: null, servings: 6 }

describe('recipeBodySchema', () => {
	it('fills the optional fields with null', () => {
		const parsed = recipeBodySchema.parse({ ingredients: [ingredient] })
		expect(parsed).toMatchObject({ waterMl: null, cookedGrams: null, servings: null })
		expect(parsed.ingredients[0]?.fiber).toBeNull()
	})

	it.each([
		['no ingredients', { ...body, ingredients: [] }],
		['31 ingredients', { ...body, ingredients: Array.from({ length: 31 }, () => ingredient) }],
		['ingredient over 5000 g', { ...body, ingredients: [{ ...ingredient, grams: 5001 }] }],
		['negative kcal', { ...body, ingredients: [{ ...ingredient, kcal: -1 }] }],
		['negative water', { ...body, waterMl: -1 }],
		['water over 20000', { ...body, waterMl: 20_001 }],
		['zero cooked weight', { ...body, cookedGrams: 0 }],
		['cooked weight over 30000', { ...body, cookedGrams: 30_001 }],
		['half a serving', { ...body, servings: 0.5 }],
		['31 servings', { ...body, servings: 31 }],
	])('rejects %s', (_label, input) => {
		expect(recipeBodySchema.safeParse(input).success).toBe(false)
	})

	it('accepts zero water', () => {
		expect(recipeBodySchema.safeParse({ ...body, waterMl: 0 }).success).toBe(true)
	})
})

describe('recipeDraftSchema', () => {
	it('has no portion grams and no pot id: they are not part of the stored JSON', () => {
		expect(Object.keys(recipeDraftSchema.shape).sort()).toEqual([
			'cookedGrams',
			'ingredients',
			'servings',
			'waterMl',
		])
	})

	it('reads a stored draft', () => {
		expect(recipeDraftSchema.parse(body).servings).toBe(6)
	})

	it('rejects a broken stored draft', () => {
		expect(recipeDraftSchema.safeParse({ ingredients: 'x' }).success).toBe(false)
		expect(recipeDraftSchema.safeParse(null).success).toBe(false)
		expect(recipeDraftSchema.safeParse({}).success).toBe(false)
	})
})

describe('ingredient weight', () => {
	const withGrams = (grams: number) => ({ ingredients: [{ ...ingredient, grams }] })

	it('lets a spice weigh half a gram, not less than a tenth', () => {
		expect(recipeBodySchema.safeParse(withGrams(0.5)).success).toBe(true)
		expect(recipeBodySchema.safeParse(withGrams(0.1)).success).toBe(true)
		expect(recipeBodySchema.safeParse(withGrams(0.05)).success).toBe(false)
	})
})
