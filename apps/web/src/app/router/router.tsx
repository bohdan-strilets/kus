import { createBrowserRouter, Navigate } from 'react-router'

import { ROUTES } from '@/shared/config'

import { ChatPage, ProgressPage, RecipesPage, TodayPage } from './lazy-pages'
import { RootLayout } from './RootLayout'
import { RouteErrorPage } from './RouteErrorPage'

export const router = createBrowserRouter([
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
