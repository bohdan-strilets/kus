import { apiErrorResponseSchema } from '@kus/shared'
import { isAxiosError } from 'axios'

export type ApiError =
	/** No answer from the API: offline, a timeout, or the proxy says the API is down. */
	| { kind: 'network' }
	/** The API answered in its error format (CLAUDE.md §5). */
	| { kind: 'http'; status: number; errorCode: string; details: Record<string, unknown> }
	/** Not an HTTP failure (a broken response contract, a bug). */
	| { kind: 'unknown' }

export const HTTP_STATUS = {
	unauthorized: 401,
	serverErrorMin: 500,
} as const

/** Narrows anything a request can throw into what the UI needs to pick a message. */
export const getApiError = (error: unknown): ApiError => {
	if (!isAxiosError(error)) return { kind: 'unknown' }
	if (!error.response) return { kind: 'network' }

	const { status } = error.response
	const body = apiErrorResponseSchema.safeParse(error.response.data)
	if (!body.success) {
		// a 5xx without our format comes from the proxy in front (Vite in dev, the Vercel rewrite):
		// the API itself is unreachable, which for the user is the same as no connection
		if (status >= HTTP_STATUS.serverErrorMin) return { kind: 'network' }
		return { kind: 'http', status, errorCode: '', details: {} }
	}
	const { errorCode, details } = body.data
	return { kind: 'http', status, errorCode, details }
}

export const isUnauthorizedError = (error: unknown): boolean => {
	const apiError = getApiError(error)
	return apiError.kind === 'http' && apiError.status === HTTP_STATUS.unauthorized
}
