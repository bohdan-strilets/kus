import type { AuthUser } from '@kus/shared'

export type SessionStatus = 'pending' | 'authenticated' | 'anonymous' | 'error'

interface SessionQueryState {
	data: AuthUser | null | undefined
	isPending: boolean
	isError: boolean
}

/** Cached data wins over a failed refetch: a known user stays logged in while the network is down. */
export const getSessionStatus = ({
	data,
	isPending,
	isError,
}: SessionQueryState): SessionStatus => {
	if (data) return 'authenticated'
	if (data === null) return 'anonymous'
	if (isError) return 'error'
	if (isPending) return 'pending'
	return 'anonymous'
}
