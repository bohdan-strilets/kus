import { Outlet } from 'react-router'

import { ToastRouteReset } from '@/shared/ui'

/**
 * Above every layout (tabs, the profile stack, auth): one ToastRouteReset sees every route change,
 * including «Назад» from «Пам'ять» to the profile and a move between the two layouts.
 */
export const RouterRoot = () => (
	<>
		<ToastRouteReset />
		<Outlet />
	</>
)
