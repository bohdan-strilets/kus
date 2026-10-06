import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'

import { DEV_ROUTES, ROUTES } from '@/shared/config'

import { ChatPage, ProgressPage, RecipesPage, TodayPage } from './lazy-pages'
import { RootLayout } from './RootLayout'
import { RouteErrorPage } from './RouteErrorPage'
import { RouteLoader } from './RouteLoader'

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
		element: <RootLayout />,
		// last resort if the layout itself fails
		errorElement: <RouteErrorPage />,
		children: [
			{
				// page errors render inside the layout, so the bottom nav stays usable
				errorElement: <RouteErrorPage />,
				children: [
					{ index: true, element: <Navigate to={ROUTES.chat} replace /> },
					{ path: ROUTES.chat, element: <ChatPage /> },
					{ path: ROUTES.today, element: <TodayPage /> },
					{ path: ROUTES.progress, element: <ProgressPage /> },
					{ path: ROUTES.recipes, element: <RecipesPage /> },
					{ path: '*', element: <Navigate to={ROUTES.chat} replace /> },
				],
			},
		],
	},
])
