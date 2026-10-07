import { QueryClient } from '@tanstack/react-query'

import { isRetriableError } from '@/shared/api'

const MAX_RETRIES = 2
const DEFAULT_STALE_TIME_MS = 30_000

export const shouldRetry = (failureCount: number, error: unknown): boolean =>
	failureCount < MAX_RETRIES && isRetriableError(error)

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// default retryDelay is exponential backoff
			retry: shouldRetry,
			staleTime: DEFAULT_STALE_TIME_MS,
		},
		// a replayed login or «add entry» can do the action twice or burn a lockout attempt
		mutations: { retry: false },
	},
})
