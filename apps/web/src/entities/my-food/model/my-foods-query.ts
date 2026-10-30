import { queryOptions } from '@tanstack/react-query'

import { getMyFoods } from '../api/get-my-foods'

/** Every list and search of «Мої продукти» lives under this key; a new saved food invalidates all. */
export const MY_FOODS_QUERY_KEY = ['my-foods'] as const

export const myFoodsQueryOptions = queryOptions({
	queryKey: [...MY_FOODS_QUERY_KEY, 'list'],
	queryFn: getMyFoods,
})
