import { type ApiMessage, getAccountLockedMessage, getApiError } from '@/shared/api'

const HTTP_TOO_MANY_REQUESTS = 429
const HTTP_SERVER_ERROR_MIN = 500

/** One line under the password field: the dialog has no other place for a message. */
export const getDeleteAccountError = (error: unknown): ApiMessage => {
	const apiError = getApiError(error)
	if (apiError.kind === 'network') return { key: 'errors.api.NETWORK' }
	if (apiError.kind === 'unknown') return { key: 'errors.api.UNKNOWN' }

	const { status, errorCode, details } = apiError
	if (errorCode === 'PASSWORD_INCORRECT') return { key: 'errors.api.PASSWORD_INCORRECT' }
	if (errorCode === 'ACCOUNT_LOCKED') return getAccountLockedMessage(details)
	if (status === HTTP_TOO_MANY_REQUESTS) return { key: 'errors.api.TOO_MANY_REQUESTS' }
	if (status >= HTTP_SERVER_ERROR_MIN) return { key: 'errors.api.SERVER' }
	return { key: 'errors.api.UNKNOWN' }
}
