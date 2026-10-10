import type { AuthUser } from '@kus/shared'
import { type QueryClient, queryOptions } from '@tanstack/react-query'

import { isRetriableError } from '@/shared/api'

import { getMe } from '../api/get-me'

export const SESSION_QUERY_KEY = ['session', 'me'] as const

/** One retry, not the default two: the whole app waits behind this check on a cold start. */
const MAX_SESSION_RETRIES = 1

const shouldRetrySession = (failureCount: number, error: unknown): boolean =>
	failureCount < MAX_SESSION_RETRIES && isRetriableError(error)

export const sessionQueryOptions = queryOptions({
	queryKey: SESSION_QUERY_KEY,
	queryFn: getMe,
	retry: shouldRetrySession,
	// the session changes only through login, logout or a dead refresh — all of them write the cache
	staleTime: Number.POSITIVE_INFINITY,
	refetchOnWindowFocus: false,
})

/**
 * The session entry changes owner: nothing cached for the previous one may survive. An in-flight
 * /users/me is cancelled so its late answer can't overwrite the new value.
 */
const replaceSession = (queryClient: QueryClient, user: AuthUser | null): void => {
	void queryClient.cancelQueries({ queryKey: SESSION_QUERY_KEY })
	queryClient.removeQueries({
		predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0],
	})
	queryClient.setQueryData(SESSION_QUERY_KEY, user)
}

/** The same user, new profile fields (PATCH /users/me): the rest of the cache stays. */
export const updateSessionUser = (queryClient: QueryClient, user: AuthUser): void => {
	queryClient.setQueryData(SESSION_QUERY_KEY, user)
}

/** After a login or registration: the guards see the user at once, no extra /users/me. */
export const setSessionUser = (queryClient: QueryClient, user: AuthUser): void => {
	replaceSession(queryClient, user)
}

/**
 * Logout or a dead refresh: keep the session entry as an explicit «anonymous» — clearing it would
 * refetch /users/me and start the refresh cycle again.
 */
export const endSession = (queryClient: QueryClient): void => {
	replaceSession(queryClient, null)
}

/** The API said the account awaits deletion: the guards then send every page to account-restore. */
export const markSessionPendingDeletion = (
	queryClient: QueryClient,
	purgeAt: string | null,
): void => {
	queryClient.setQueryData<AuthUser | null>(SESSION_QUERY_KEY, (user) =>
		user ? { ...user, pendingDeletion: true, purgeAt } : user,
	)
}
