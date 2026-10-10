import type { AxiosInstance } from 'axios'

import { getApiError, HTTP_STATUS } from './api-error'

const PENDING_DELETION_ERROR_CODE = 'ACCOUNT_PENDING_DELETION'

export interface PendingDeletionInterceptorOptions {
	/** The API refused a request because the account is awaiting deletion; `purgeAt` is an ISO date. */
	onPendingDeletion: (purgeAt: string | null) => void
}

/**
 * Notices «account pending deletion» on any call and tells the app; the error itself always goes
 * on to the caller. Returns the detach function.
 */
export const attachPendingDeletionInterceptor = (
	client: AxiosInstance,
	{ onPendingDeletion }: PendingDeletionInterceptorOptions,
): (() => void) => {
	const interceptorId = client.interceptors.response.use(undefined, (error: unknown) => {
		const apiError = getApiError(error)
		const isPendingDeletion =
			apiError.kind === 'http' &&
			apiError.status === HTTP_STATUS.forbidden &&
			apiError.errorCode === PENDING_DELETION_ERROR_CODE
		if (isPendingDeletion) {
			const { purgeAt } = apiError.details
			onPendingDeletion(typeof purgeAt === 'string' ? purgeAt : null)
		}
		throw error
	})

	return () => {
		client.interceptors.response.eject(interceptorId)
	}
}
