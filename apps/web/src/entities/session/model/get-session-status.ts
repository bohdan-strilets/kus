import type { AuthUser } from '@kus/shared'

export type SessionStatus = 'pending' | 'authenticated' | 'anonymous' | 'error'

interface SessionQueryState {
	data: AuthUser | null | undefined
	isPending: boolean
	isError: boolean
	/** The first check waits for the network (`fetchStatus: 'paused'`) — it is `pending` for TanStack Query. */
	isPaused?: boolean
}

/** Cached data wins over a failed refetch: a known user stays logged in while the network is down. */
export const getSessionStatus = ({
	data,
	isPending,
	isError,
	isPaused = false,
}: SessionQueryState): SessionStatus => {
	if (data) return 'authenticated'
	if (data === null) return 'anonymous'
	// a paused check never ends by itself while offline: it is the same «no connection» as a failed one
	if (isError || isPaused) return 'error'
	if (isPending) return 'pending'
	return 'anonymous'
}
