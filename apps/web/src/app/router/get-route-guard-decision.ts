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
	| { action: 'error' }
	| { action: 'redirect'; to: string; state?: ReturnState }

interface GuardInput {
	guard: RouteGuard
	status: SessionStatus
	/**
	 * The session check failed for lack of a connection (not an answer of the API). A 5xx without the
	 * API's error format (a proxy in front) counts too: the API is unreachable, which is offline for us.
	 */
	isNetworkError?: boolean
	/**
	 * The device holds the last live session of its last known user (`lastSeen` in the live store).
	 * Lets the live screen render while the session check is still pending or has failed offline.
	 */
	hasOfflineLive?: boolean
	/** The very first decision of this page lifetime (a cold start), see `route-entry.ts`. */
	isEntry?: boolean
	/** The last action in that copy is younger than the 3 h the server keeps a session open. */
	isOfflineLiveFresh?: boolean
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
 * session, everywhere else it is «retry» in the shell, with the mini strip as the way back.
 */
const getOfflineDecision = (path: string, hasOfflineLive: boolean): GuardDecision => {
	if (hasOfflineLive && getPathname(path) === TRAINING_LIVE_ROUTE) return { action: 'render' }
	return { action: 'error' }
}

/**
 * A cold start with a fresh open workout goes straight into it, with or without a network and
 * without waiting for the session check. Not for an account awaiting deletion, not when already there.
 */
const shouldEnterLive = ({
	guard,
	status,
	isNetworkError = false,
	hasOfflineLive = false,
	isEntry = false,
	isOfflineLiveFresh = false,
	path,
	isPendingDeletion,
}: GuardInput): boolean => {
	if (guard !== 'protected' || !isEntry || !hasOfflineLive || !isOfflineLiveFresh) return false
	if (isPendingDeletion || getPathname(path) === TRAINING_LIVE_ROUTE) return false
	if (status === 'error') return isNetworkError
	return status === 'pending' || status === 'authenticated'
}

export const getRouteGuardDecision = (input: GuardInput): GuardDecision => {
	if (shouldEnterLive(input)) return { action: 'redirect', to: TRAINING_LIVE_ROUTE }
	const {
		guard,
		status,
		isNetworkError = false,
		hasOfflineLive = false,
		path,
		locationState,
		isPendingDeletion,
	} = input

	// nothing renders until the session is known: no flash of the login form or of the app
	if (status === 'pending') {
		// a lie-fi start: the check may hang for a minute, the live session of the last user needn't wait
		const canShowLive =
			guard === 'protected' && hasOfflineLive && getPathname(path) === TRAINING_LIVE_ROUTE
		return canShowLive ? { action: 'render' } : { action: 'loading' }
	}

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
