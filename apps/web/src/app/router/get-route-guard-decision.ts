import type { SessionStatus } from '@/entities/session'
import { isProtectedPath, ROUTES, TRAINING_LIVE_ROUTE } from '@/shared/config'

export type RouteGuard = 'protected' | 'guest'

/** Where a protected page sends the user and where login brings them back. */
export interface ReturnState {
	from: string
}

export type GuardDecision =
	| { action: 'render' }
	| { action: 'loading' }
	/** `canResumeLive`: offline, with a live session of this device's last user to go back to. */
	| { action: 'error'; canResumeLive?: true }
	| { action: 'redirect'; to: string; state?: ReturnState }

interface GuardInput {
	guard: RouteGuard
	status: SessionStatus
	/**
	 * The session check failed for lack of a connection (not an answer of the API). A 5xx without the
	 * API's error format (a proxy in front) counts too: the API is unreachable, which is offline for us.
	 */
	isNetworkError?: boolean
	/** The device holds the last live session of its last known user (`lastSeen` in the live store). */
	hasOfflineLive?: boolean
	/** pathname + search + hash of the current location. */
	path: string
	/** location.state, whatever it holds — it can come from history, so it's untrusted. */
	locationState: unknown
	/** The account awaits deletion: the only page left is account-restore. */
	isPendingDeletion: boolean
}

/** Only a path inside /app: never an absolute URL or a guest page, so no open redirect. */
export const getReturnPath = (locationState: unknown): string | null => {
	if (typeof locationState !== 'object' || locationState === null) return null
	const from: unknown = Reflect.get(locationState, 'from')
	if (typeof from !== 'string') return null
	const [pathname = ''] = from.split(/[?#]/)
	// «/app/../login» passes the prefix check but resolves outside /app
	if (pathname.split('/').includes('..')) return null
	return isProtectedPath(pathname) ? from : null
}

const getPathname = (path: string): string => path.split(/[?#]/)[0] ?? ''

/** A pending-deletion account sees only account-restore; everyone else has no business there. */
const getAuthenticatedDecision = (path: string, isPendingDeletion: boolean): GuardDecision => {
	const isOnRestore = getPathname(path) === ROUTES.accountRestore
	if (isPendingDeletion && !isOnRestore) return { action: 'redirect', to: ROUTES.accountRestore }
	if (!isPendingDeletion && isOnRestore) return { action: 'redirect', to: ROUTES.chat }
	return { action: 'render' }
}

/**
 * No connection and no cached user: the live screen alone still works from the copy of the last
 * session, everywhere else it is «retry» with a way back into that session.
 */
const getOfflineDecision = (path: string, hasOfflineLive: boolean): GuardDecision => {
	if (!hasOfflineLive) return { action: 'error' }
	if (getPathname(path) === TRAINING_LIVE_ROUTE) return { action: 'render' }
	return { action: 'error', canResumeLive: true }
}

export const getRouteGuardDecision = ({
	guard,
	status,
	isNetworkError = false,
	hasOfflineLive = false,
	path,
	locationState,
	isPendingDeletion,
}: GuardInput): GuardDecision => {
	// nothing renders until the session is known: no flash of the login form or of the app
	if (status === 'pending') return { action: 'loading' }

	if (guard === 'protected') {
		if (status === 'authenticated') return getAuthenticatedDecision(path, isPendingDeletion)
		// the network failed, not the session: show «retry», don't throw the user out
		if (status === 'error') return getOfflineDecision(path, isNetworkError && hasOfflineLive)
		return { action: 'redirect', to: ROUTES.login, state: { from: path } }
	}

	if (status === 'authenticated') {
		if (isPendingDeletion) return { action: 'redirect', to: ROUTES.accountRestore }
		return { action: 'redirect', to: getReturnPath(locationState) ?? ROUTES.chat }
	}
	// anonymous, or the check failed: the form works anyway and reports the network itself
	return { action: 'render' }
}
