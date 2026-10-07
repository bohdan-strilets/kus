import { useQuery } from '@tanstack/react-query'

import { getSessionStatus, type SessionStatus } from './get-session-status'
import { sessionQueryOptions } from './session-query'

export interface Session {
	status: SessionStatus
	retry: () => void
}

export const useSession = (): Session => {
	const query = useQuery(sessionQueryOptions)
	return {
		status: getSessionStatus(query),
		retry: () => {
			void query.refetch()
		},
	}
}
