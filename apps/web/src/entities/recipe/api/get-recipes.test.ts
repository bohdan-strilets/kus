import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'

import { getRecipe } from './get-recipe'
import { getRecipes } from './get-recipes'

const ID = '0199b3a4-0000-7000-8000-000000000001'
const item = {
	id: ID,
	name: 'Борщ',
	category: 'borscht',
	kcal: 190,
	protein: 8,
	fat: 7,
	carbs: 24,
	portionGrams: 350,
	usageCount: 7,
	lastUsedAt: null,
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe('recipes api', () => {
	it('parses a page and passes the pagination params', async () => {
		const get = vi.spyOn(httpClient, 'get').mockResolvedValue({
			data: { data: [item], meta: { total: 1, page: 2, limit: 10, totalPages: 1 } },
		})

		const page = await getRecipes({ page: 2, limit: 10 })

		expect(get).toHaveBeenCalledWith('/recipes', { params: { page: 2, limit: 10 } })
		expect(page.data[0]?.name).toBe('Борщ')
	})

	it('rejects a broken page', async () => {
		vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [{ id: 1 }] } })

		await expect(getRecipes()).rejects.toThrow()
	})

	it('parses a recipe', async () => {
		const get = vi.spyOn(httpClient, 'get').mockResolvedValue({
			data: {
				data: {
					...item,
					cookedGrams: 700,
					ingredients: [
						{ id: ID, name: 'Буряк', grams: 100, kcal: 43, protein: 2, fat: 0, carbs: 10 },
					],
					portions: [{ share: 1, grams: 350, kcal: 190, protein: 8, fat: 7, carbs: 24 }],
				},
			},
		})

		const recipe = await getRecipe(ID)

		expect(get).toHaveBeenCalledWith(`/recipes/${ID}`)
		expect(recipe.ingredients).toHaveLength(1)
	})
})
