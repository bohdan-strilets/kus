import { queryOptions } from '@tanstack/react-query'

import { getDay } from '../api/get-day'

/** Every day lives under this key; a logged meal or a new goal invalidates all of them. */
export const DAY_QUERY_KEY = ['day'] as const

export const dayQueryOptions = (localDate: string) =>
	queryOptions({
		queryKey: [...DAY_QUERY_KEY, localDate],
		queryFn: () => getDay(localDate),
	})
