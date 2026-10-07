import type { SessionStatus } from '@/entities/session'
import { isProtectedPath, ROUTES } from '@/shared/config'

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
	/** pathname + search + hash of the current location. */
	path: string
	/** location.state, whatever it holds — it can come from history, so it's untrusted. */
	locationState: unknown
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

export const getRouteGuardDecision = ({
	guard,
	status,
	path,
	locationState,
}: GuardInput): GuardDecision => {
	// nothing renders until the session is known: no flash of the login form or of the app
	if (status === 'pending') return { action: 'loading' }

	if (guard === 'protected') {
		if (status === 'authenticated') return { action: 'render' }
		// the network failed, not the session: show «retry», don't throw the user out
		if (status === 'error') return { action: 'error' }
		return { action: 'redirect', to: ROUTES.login, state: { from: path } }
	}

	if (status === 'authenticated') {
		return { action: 'redirect', to: getReturnPath(locationState) ?? ROUTES.chat }
	}
	// anonymous, or the check failed: the form works anyway and reports the network itself
	return { action: 'render' }
}
