import type { QueryClient } from '@tanstack/react-query'
import type { AxiosInstance } from 'axios'

import { endSession, markSessionPendingDeletion, refreshSession } from '@/entities/session'
import { attachPendingDeletionInterceptor, attachRefreshInterceptor } from '@/shared/api'

interface SetupSessionOptions {
	client: AxiosInstance
	queryClient: QueryClient
}

/**
 * Silent refresh for every API call. A dead refresh token only marks the session anonymous:
 * RequireSession then sends a protected page to /login, while /login and /register stay put —
 * no redirect and no second /users/me from here. A 403 ACCOUNT_PENDING_DELETION marks the user in
 * the cache, and the route guard then sends the app to account-restore.
 */
export const setupSession = ({ client, queryClient }: SetupSessionOptions): (() => void) => {
	const detachRefresh = attachRefreshInterceptor(client, {
		refresh: refreshSession,
		onRefreshFailed: () => {
			endSession(queryClient)
		},
	})
	const detachPendingDeletion = attachPendingDeletionInterceptor(client, {
		onPendingDeletion: (purgeAt) => {
			markSessionPendingDeletion(queryClient, purgeAt)
		},
	})
	return () => {
		detachRefresh()
		detachPendingDeletion()
	}
}
