import { Suspense } from 'react'
import { Outlet } from 'react-router'

import { RouteLoader } from './RouteLoader'

/** Lazy pages outside RootLayout (login, registration) need their own Suspense boundary. */
export const SuspenseOutlet = () => (
	<Suspense fallback={<RouteLoader />}>
		<Outlet />
	</Suspense>
)
