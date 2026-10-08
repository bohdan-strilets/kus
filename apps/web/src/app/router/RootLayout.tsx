import { Suspense } from 'react'
import { Outlet, useMatch } from 'react-router'

import { ROUTES } from '@/shared/config'
import { AppLayout } from '@/shared/ui'
import { BottomNav, useTodayProgress } from '@/widgets/bottom-nav'

import { RouteLoader } from './RouteLoader'

export const RootLayout = () => {
	// the chat scrolls inside its feed, between the header and the composer
	const isChat = useMatch({ path: ROUTES.chat, end: true }) !== null
	const todayProgress = useTodayProgress()

	return (
		<AppLayout bottomNav={<BottomNav todayProgress={todayProgress} />} isFixedHeight={isChat}>
			<Suspense fallback={<RouteLoader />}>
				<Outlet />
			</Suspense>
		</AppLayout>
	)
}
