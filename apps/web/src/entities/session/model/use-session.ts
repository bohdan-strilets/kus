import { useQuery } from '@tanstack/react-query'

import { getApiError } from '@/shared/api'

import { getSessionStatus, type SessionStatus } from './get-session-status'
import { sessionQueryOptions } from './session-query'

export interface Session {
	status: SessionStatus
	/** The check failed for lack of a connection, not with an answer of the API. */
	isNetworkError: boolean
	retry: () => void
}

export const useSession = (): Session => {
	const query = useQuery(sessionQueryOptions)
	return {
		status: getSessionStatus(query),
		isNetworkError: query.isError && getApiError(query.error).kind === 'network',
		retry: () => {
			void query.refetch()
		},
	}
}
