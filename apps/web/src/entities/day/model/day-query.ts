import { queryOptions } from '@tanstack/react-query'

import { getDay } from '../api/get-day'
import { getDays } from '../api/get-days'

/** Every day lives under this key; a logged meal or a new goal invalidates all of them. */
export const DAY_QUERY_KEY = ['day'] as const

export const dayQueryOptions = (localDate: string) =>
	queryOptions({
		queryKey: [...DAY_QUERY_KEY, localDate],
		queryFn: () => getDay(localDate),
	})

/** Under the same key as the days themselves: whatever refreshes a day refreshes the strip. */
export const daysRangeQueryOptions = (range: { from: string; to: string }) =>
	queryOptions({
		queryKey: [...DAY_QUERY_KEY, 'range', range.from, range.to],
		queryFn: () => getDays(range),
	})
