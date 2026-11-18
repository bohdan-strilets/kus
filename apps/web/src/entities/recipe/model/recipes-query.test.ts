import { describe, expect, it } from 'vitest'

import { RECIPES_QUERY_KEY, recipeQueryOptions, recipesQueryOptions } from './recipes-query'

describe('recipes query options', () => {
	it('keeps every recipe query under the shared key', () => {
		expect(recipesQueryOptions().queryKey.slice(0, 1)).toEqual(RECIPES_QUERY_KEY)
		expect(recipeQueryOptions('abc').queryKey.slice(0, 1)).toEqual(RECIPES_QUERY_KEY)
	})

	it('separates pages and recipes by their params', () => {
		expect(recipesQueryOptions({ page: 2 }).queryKey).not.toEqual(recipesQueryOptions().queryKey)
		expect(recipeQueryOptions('a').queryKey).not.toEqual(recipeQueryOptions('b').queryKey)
	})
})
