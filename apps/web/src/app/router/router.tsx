import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'

import { DEV_ROUTES, ROUTES } from '@/shared/config'

import {
	ChatPage,
	LoginPage,
	ProgressPage,
	RecipesPage,
	RegisterPage,
	TodayPage,
} from './lazy-pages'
import { RootLayout } from './RootLayout'
import { RouteErrorPage } from './RouteErrorPage'
import { RouteLoader } from './RouteLoader'
import { SessionGuard } from './SessionGuard'
import { SuspenseOutlet } from './SuspenseOutlet'

// `import.meta.env.DEV` is a build-time constant: in production this branch and its chunk are dropped
const devRoutes: RouteObject[] = import.meta.env.DEV
	? [
			{
				path: DEV_ROUTES.ui,
				errorElement: <RouteErrorPage />,
				hydrateFallbackElement: <RouteLoader />,
				lazy: () => import('@/pages/dev-ui').then((m) => ({ Component: m.DevUiPage })),
			},
		]
	: []

export const router = createBrowserRouter([
	...devRoutes,
	{
		errorElement: <RouteErrorPage />,
		children: [
			// no landing yet (static page before beta): the guards pick /app or /login
			{ index: true, element: <Navigate to={ROUTES.chat} replace /> },
			{
				element: <SessionGuard guard="guest" />,
				children: [
					{
						element: <SuspenseOutlet />,
						children: [
							{ path: ROUTES.login, element: <LoginPage /> },
							{ path: ROUTES.register, element: <RegisterPage /> },
						],
					},
				],
			},
			{
				path: ROUTES.chat,
				element: <SessionGuard guard="protected" />,
				children: [
					{
						element: <RootLayout />,
						children: [
							{
								// page errors render inside the layout, so the bottom nav stays usable
								errorElement: <RouteErrorPage />,
								children: [
									{ index: true, element: <ChatPage /> },
									{ path: ROUTES.today, element: <TodayPage /> },
									{ path: ROUTES.progress, element: <ProgressPage /> },
									{ path: ROUTES.recipes, element: <RecipesPage /> },
									{ path: '*', element: <Navigate to={ROUTES.chat} replace /> },
								],
							},
						],
					},
				],
			},
			{ path: '*', element: <Navigate to={ROUTES.chat} replace /> },
		],
	},
])
