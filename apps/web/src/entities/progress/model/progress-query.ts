import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { DAY_QUERY_KEY } from '@/entities/day'

import { getProgress } from '../api/get-progress'
import type { ProgressRange } from './progress.types'

/**
 * Under the day key on purpose: whatever refreshes a day (a chat turn, an edited entry, a new
 * goal) also refreshes the week card, the weights and the insight. Not a single day, so
 * watch-day-goal ignores it: it reads only two-part day keys, and this one is longer.
 */
export const PROGRESS_QUERY_KEY = [...DAY_QUERY_KEY, 'progress'] as const

const PROGRESS_STALE_TIME_MS = 60_000

/**
 * Retries come from the app's QueryClient: backoff for network and 5xx, none for 4xx.
 * Switching the range keeps the previous numbers on screen until the new ones arrive.
 */
export const progressQueryOptions = (range: ProgressRange, today: string) =>
	queryOptions({
		queryKey: [...PROGRESS_QUERY_KEY, range, today],
		queryFn: () => getProgress(range),
		staleTime: PROGRESS_STALE_TIME_MS,
		placeholderData: keepPreviousData,
	})
