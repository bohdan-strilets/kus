import { Suspense } from 'react'
import { Outlet } from 'react-router'

import { AppLayout } from '@/shared/ui'
import { BottomNav } from '@/widgets/bottom-nav'

import { RouteLoader } from './RouteLoader'

export const RootLayout = () => (
	<AppLayout bottomNav={<BottomNav />}>
		<Suspense fallback={<RouteLoader />}>
			<Outlet />
		</Suspense>
	</AppLayout>
)
