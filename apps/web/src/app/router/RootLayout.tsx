import { AnimatePresence } from 'motion/react'
import { type ReactNode, Suspense, useState } from 'react'
import { useLocation, useMatch, useOutlet } from 'react-router'

import { useForgottenFoodToast } from '@/features/undo-forget-food'
import { FEATURES, ROUTES, TRAINING_LIVE_ROUTE } from '@/shared/config'
import { useUnlockSoundOnFirstTap } from '@/shared/lib'
import { AppLayout } from '@/shared/ui'
import { BottomNav, useTodayProgress } from '@/widgets/bottom-nav'
import {
	useMiniStripLive,
	useMiniStripOffline,
	WorkoutMiniStrip,
} from '@/widgets/workout-mini-strip'

import { preloadTrainingLive, TrainingPage } from './lazy-pages'
import { LiveSurface } from './LiveSurface'
import { RouteLoader } from './RouteLoader'

/** The tab that was on screen before the live screen opened over it. */
interface Background {
	pathname: string
	outlet: ReactNode
}

export const RootLayout = () => {
	const { pathname } = useLocation()
	const outlet = useOutlet()
	const isLive = useMatch({ path: TRAINING_LIVE_ROUTE, end: true }) !== null
	// The live screen is a surface over the tab, not a screen of its own: the tab (and the bottom
	// nav) stays mounted under it. The last outlet before the live route is kept for that; a deep
	// link has none and shows the training tab.
	const [background, setBackground] = useState<Background | null>(null)
	if (!isLive && background?.pathname !== pathname) setBackground({ pathname, outlet })

	const tabPathname = isLive ? (background?.pathname ?? ROUTES.training) : pathname
	// the chat scrolls inside its feed, between the header and the composer
	const isChat = tabPathname === ROUTES.chat
	const todayProgress = useTodayProgress()
	const liveWorkout = useMiniStripLive()
	const isStripOffline = useMiniStripOffline()
	// the first tap anywhere in the app lets iOS play the «кусь» later, outside a gesture
	useUnlockSoundOnFirstTap()
	// a food Kusik removed in a reply that arrived on any screen
	useForgottenFoodToast()

	return (
		<AppLayout
			bottomNav={<BottomNav todayProgress={todayProgress} />}
			isFixedHeight={isChat}
			hasRaisedNav={FEATURES.workouts}
			isNavInert={isLive}
			miniStrip={
				liveWorkout ? (
					<WorkoutMiniStrip
						live={liveWorkout}
						isOffline={isStripOffline}
						onWarm={preloadTrainingLive}
					/>
				) : undefined
			}
		>
			{/* `contents` keeps the tab's layout; `inert` takes it out of Tab order and the a11y tree
			    while the surface covers it (it drops the moment the route leaves live, before the fold) */}
			<div inert={isLive} className="contents">
				<Suspense fallback={<RouteLoader />}>
					{isLive ? (background?.outlet ?? <TrainingPage />) : outlet}
				</Suspense>
			</div>
			<AnimatePresence>
				{isLive && (
					<LiveSurface key="live">
						{/* the screen's own chunk loads inside the surface, so the tab under it never flashes a loader */}
						<Suspense fallback={null}>{outlet}</Suspense>
					</LiveSurface>
				)}
			</AnimatePresence>
		</AppLayout>
	)
}
