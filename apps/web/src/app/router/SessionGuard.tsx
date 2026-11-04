import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'

import { useSession, useSessionUser } from '@/entities/session'
import { useLastSeenLive, useLiveWorkoutStore } from '@/features/live-workout'
import { TRAINING_LIVE_ROUTE } from '@/shared/config'

import { getRouteGuardDecision, type RouteGuard } from './get-route-guard-decision'
import { RouteLoader } from './RouteLoader'
import { SessionErrorState } from './SessionErrorState'

/** Layout route: `protected` for /app/*, `guest` for /login and /register. */
export const SessionGuard = ({ guard }: { guard: RouteGuard }) => {
	const session = useSession()
	const location = useLocation()
	const navigate = useNavigate()
	const isPendingDeletion = useSessionUser()?.pendingDeletion ?? false
	const lastSeen = useLastSeenLive()
	// the store drops `lastSeen` whenever the owner changes or leaves, so what is left is the last known user's
	const hasKnownOwner = useLiveWorkoutStore((state) => state.ownerId !== null)
	const decision = getRouteGuardDecision({
		guard,
		status: session.status,
		isNetworkError: session.isNetworkError,
		hasOfflineLive: hasKnownOwner && lastSeen !== null,
		path: `${location.pathname}${location.search}${location.hash}`,
		locationState: location.state,
		isPendingDeletion,
	})

	switch (decision.action) {
		case 'loading':
			return <RouteLoader />
		case 'error':
			return (
				<SessionErrorState
					onRetry={session.retry}
					onResumeLive={
						decision.canResumeLive
							? () => {
									void navigate(TRAINING_LIVE_ROUTE)
								}
							: undefined
					}
				/>
			)
		case 'redirect':
			return <Navigate to={decision.to} state={decision.state} replace />
		case 'render':
			return <Outlet />
	}
}
