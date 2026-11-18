import { type RecipesQuery } from '@kus/shared'
import { queryOptions } from '@tanstack/react-query'

import { getRecipe } from '../api/get-recipe'
import { getRecipes } from '../api/get-recipes'

/** Every list and card of a recipe lives under this key; a saved, edited or removed recipe invalidates all. */
export const RECIPES_QUERY_KEY = ['recipes'] as const

/** Recipes change in the chat, and the screens refetch on mount: a minute is enough in between. */
const RECIPES_STALE_TIME_MS = 60_000

export const recipesQueryOptions = (params: Partial<RecipesQuery> = {}) =>
	queryOptions({
		queryKey: [...RECIPES_QUERY_KEY, 'list', params],
		queryFn: () => getRecipes(params),
		staleTime: RECIPES_STALE_TIME_MS,
	})

export const recipeQueryOptions = (id: string) =>
	queryOptions({
		queryKey: [...RECIPES_QUERY_KEY, 'detail', id],
		queryFn: () => getRecipe(id),
		staleTime: RECIPES_STALE_TIME_MS,
	})
