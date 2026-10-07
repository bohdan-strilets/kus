import { getApiError, HTTP_STATUS } from './api-error'

/**
 * Only what can fix itself: network failures, timeouts and 5xx. A 4xx or a broken response
 * contract (ZodError) fails the same way every time.
 */
export const isRetriableError = (error: unknown): boolean => {
	const apiError = getApiError(error)
	if (apiError.kind === 'network') return true
	return apiError.kind === 'http' && apiError.status >= HTTP_STATUS.serverErrorMin
}
