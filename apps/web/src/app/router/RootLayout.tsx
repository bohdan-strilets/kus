import { Suspense } from 'react'
import { Outlet, useMatch } from 'react-router'

import { FEATURES, ROUTES } from '@/shared/config'
import { useUnlockSoundOnFirstTap } from '@/shared/lib'
import { AppLayout } from '@/shared/ui'
import { BottomNav, useTodayProgress } from '@/widgets/bottom-nav'
import { useMiniStripLive, WorkoutMiniStrip } from '@/widgets/workout-mini-strip'

import { RouteLoader } from './RouteLoader'

export const RootLayout = () => {
	// the chat scrolls inside its feed, between the header and the composer
	const isChat = useMatch({ path: ROUTES.chat, end: true }) !== null
	const todayProgress = useTodayProgress()
	const liveWorkout = useMiniStripLive()
	// the first tap anywhere in the app lets iOS play the «кусь» later, outside a gesture
	useUnlockSoundOnFirstTap()

	return (
		<AppLayout
			bottomNav={<BottomNav todayProgress={todayProgress} />}
			isFixedHeight={isChat}
			hasRaisedNav={FEATURES.workouts}
			miniStrip={liveWorkout ? <WorkoutMiniStrip live={liveWorkout} /> : undefined}
		>
			<Suspense fallback={<RouteLoader />}>
				<Outlet />
			</Suspense>
		</AppLayout>
	)
}
