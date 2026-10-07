import { Suspense } from 'react'
import { Outlet } from 'react-router'

import { LogoutButton } from '@/features/logout'
import { AppLayout } from '@/shared/ui'
import { BottomNav } from '@/widgets/bottom-nav'

import { RouteLoader } from './RouteLoader'

export const RootLayout = () => (
	<AppLayout bottomNav={<BottomNav />}>
		{/* temporary: logout moves to the profile screen once it exists (stage 6) */}
		<div className="flex justify-end px-gutter pt-3">
			<LogoutButton />
		</div>
		<Suspense fallback={<RouteLoader />}>
			<Outlet />
		</Suspense>
	</AppLayout>
)
