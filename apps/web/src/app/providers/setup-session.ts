import type { QueryClient } from '@tanstack/react-query'
import type { AxiosInstance } from 'axios'

import { endSession, refreshSession } from '@/entities/session'
import { attachRefreshInterceptor } from '@/shared/api'

interface SetupSessionOptions {
	client: AxiosInstance
	queryClient: QueryClient
}

/**
 * Silent refresh for every API call. A dead refresh token only marks the session anonymous:
 * RequireSession then sends a protected page to /login, while /login and /register stay put —
 * no redirect and no second /users/me from here.
 */
export const setupSession = ({ client, queryClient }: SetupSessionOptions): (() => void) =>
	attachRefreshInterceptor(client, {
		refresh: refreshSession,
		onRefreshFailed: () => {
			endSession(queryClient)
		},
	})
