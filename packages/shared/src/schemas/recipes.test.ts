import { describe, expect, it } from 'vitest'

import {
	logRecipePortionRequestSchema,
	recipeListItemSchema,
	recipeParamsSchema,
	recipesQuerySchema,
} from './recipes.js'

const ID = '0190f3a0-0000-7000-8000-000000000001'

describe('recipesQuerySchema', () => {
	it('fills the defaults and coerces strings', () => {
		expect(recipesQuerySchema.parse({})).toEqual({ page: 1, limit: 20 })
		expect(recipesQuerySchema.parse({ page: '2', limit: '50' })).toEqual({ page: 2, limit: 50 })
	})

	it('rejects a limit above 50', () => {
		expect(recipesQuerySchema.safeParse({ limit: '51' }).success).toBe(false)
	})
})

describe('recipeParamsSchema', () => {
	it('requires a uuid', () => {
		expect(recipeParamsSchema.safeParse({ id: ID }).success).toBe(true)
		expect(recipeParamsSchema.safeParse({ id: 'abc' }).success).toBe(false)
	})
})

describe('logRecipePortionRequestSchema', () => {
	it.each([0.5, 1, 1.5])('accepts share %s', (share) => {
		expect(logRecipePortionRequestSchema.safeParse({ share }).success).toBe(true)
	})

	it.each([0, 2, '1'])('rejects share %s', (share) => {
		expect(logRecipePortionRequestSchema.safeParse({ share }).success).toBe(false)
	})
})

describe('recipeListItemSchema', () => {
	it('accepts a never-used recipe', () => {
		const item = {
			id: ID,
			name: 'Борщ',
			category: 'soup',
			portionGrams: 450,
			kcal: 120,
			protein: 5,
			fat: 4,
			carbs: 15,
			usageCount: 0,
			lastUsedAt: null,
		}

		expect(recipeListItemSchema.safeParse(item).success).toBe(true)
	})
})
