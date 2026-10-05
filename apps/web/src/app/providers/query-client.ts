import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

const MAX_RETRIES = 3
const DEFAULT_STALE_TIME_MS = 30_000
const HTTP_SERVER_ERROR_MIN = 500

/**
 * Retry only what can fix itself: network failures, timeouts and 5xx. A 4xx or a broken
 * response contract (ZodError) fails the same way every time.
 */
export const shouldRetry = (failureCount: number, error: unknown): boolean => {
	if (failureCount >= MAX_RETRIES) return false
	if (!isAxiosError(error)) return false
	if (!error.response) return true
	return error.response.status >= HTTP_SERVER_ERROR_MIN
}

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// default retryDelay is exponential backoff
			retry: shouldRetry,
			staleTime: DEFAULT_STALE_TIME_MS,
		},
	},
})
