import { Navigate, Outlet, useLocation } from 'react-router'

import { useSession, useSessionUser } from '@/entities/session'

import { getRouteGuardDecision, type RouteGuard } from './get-route-guard-decision'
import { RouteLoader } from './RouteLoader'
import { SessionErrorState } from './SessionErrorState'

/** Layout route: `protected` for /app/*, `guest` for /login and /register. */
export const SessionGuard = ({ guard }: { guard: RouteGuard }) => {
	const session = useSession()
	const location = useLocation()
	const isPendingDeletion = useSessionUser()?.pendingDeletion ?? false
	const decision = getRouteGuardDecision({
		guard,
		status: session.status,
		path: `${location.pathname}${location.search}${location.hash}`,
		locationState: location.state,
		isPendingDeletion,
	})

	switch (decision.action) {
		case 'loading':
			return <RouteLoader />
		case 'error':
			return <SessionErrorState onRetry={session.retry} />
		case 'redirect':
			return <Navigate to={decision.to} state={decision.state} replace />
		case 'render':
			return <Outlet />
	}
}
