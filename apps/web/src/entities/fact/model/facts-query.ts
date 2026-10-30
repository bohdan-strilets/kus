import { queryOptions } from '@tanstack/react-query'

import { getFacts } from '../api/get-facts'

export const FACTS_QUERY_KEY = ['facts'] as const

export const factsQueryOptions = queryOptions({
	queryKey: FACTS_QUERY_KEY,
	queryFn: getFacts,
})
