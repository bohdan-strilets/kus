import { type AxiosInstance, isAxiosError } from 'axios'

import { getApiError, HTTP_STATUS } from './api-error'

declare module 'axios' {
	interface AxiosRequestConfig {
		/** Set on the replay after a refresh, so a second 401 can't start another loop. */
		isAuthRetry?: boolean
	}
}

/** A 401 here means wrong credentials or a dead refresh token, never «access expired». */
const NO_REFRESH_PATHS: ReadonlySet<string> = new Set([
	'/auth/login',
	'/auth/register',
	'/auth/refresh',
	'/auth/logout',
])

const HTTP_CLIENT_ERROR_MIN = 400
const HTTP_TOO_MANY_REQUESTS = 429

/**
 * The refresh token won't work again: 401, or any other 4xx (a 403 from a proxy) — retrying would
 * only keep the user stuck. A 429 (refresh throttle), a 5xx and the network say nothing about it.
 */
const isDeadRefreshError = (error: unknown): boolean => {
	const apiError = getApiError(error)
	if (apiError.kind !== 'http') return false
	const { status } = apiError
	return (
		status >= HTTP_CLIENT_ERROR_MIN &&
		status < HTTP_STATUS.serverErrorMin &&
		status !== HTTP_TOO_MANY_REQUESTS
	)
}

const isNoRefreshPath = (url: string | undefined): boolean => {
	if (!url) return false
	const [path = ''] = url.split('?')
	return NO_REFRESH_PATHS.has(path)
}

export interface RefreshInterceptorOptions {
	/** POST /auth/refresh: the API rotates both httpOnly cookies. */
	refresh: () => Promise<void>
	/** The refresh token is dead (4xx except 429): the session is over. Called once per refresh. */
	onRefreshFailed: () => void
}

/**
 * On a 401 from a regular request: one refresh, then replay the request. Parallel 401s share the
 * same in-flight refresh, so the API sees a single rotation. Returns the detach function.
 */
export const attachRefreshInterceptor = (
	client: AxiosInstance,
	{ refresh, onRefreshFailed }: RefreshInterceptorOptions,
): (() => void) => {
	let refreshPromise: Promise<void> | null = null

	const refreshOnce = (): Promise<void> => {
		refreshPromise ??= refresh()
			.catch((error: unknown) => {
				if (isDeadRefreshError(error)) onRefreshFailed()
				throw error
			})
			.finally(() => {
				refreshPromise = null
			})
		return refreshPromise
	}

	const interceptorId = client.interceptors.response.use(undefined, async (error: unknown) => {
		if (!isAxiosError(error) || !error.config) throw error
		const { config } = error
		const isExpiredAccess = error.response?.status === HTTP_STATUS.unauthorized
		if (!isExpiredAccess || config.isAuthRetry || isNoRefreshPath(config.url)) throw error

		try {
			await refreshOnce()
		} catch (refreshError) {
			// a dead session keeps the original 401, so callers see «unauthorized», not «refresh failed»
			throw isDeadRefreshError(refreshError) ? error : refreshError
		}
		return client.request({ ...config, isAuthRetry: true })
	})

	return () => {
		client.interceptors.response.eject(interceptorId)
	}
}
