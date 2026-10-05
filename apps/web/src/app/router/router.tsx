import { createBrowserRouter, Navigate } from 'react-router'

import { ROUTES } from '@/shared/config'

import { ChatPage, ProgressPage, RecipesPage, TodayPage } from './lazy-pages'
import { RootLayout } from './RootLayout'

export const router = createBrowserRouter([
	{
		element: <RootLayout />,
		children: [
			{ index: true, element: <Navigate to={ROUTES.chat} replace /> },
			{ path: ROUTES.chat, element: <ChatPage /> },
			{ path: ROUTES.today, element: <TodayPage /> },
			{ path: ROUTES.progress, element: <ProgressPage /> },
			{ path: ROUTES.recipes, element: <RecipesPage /> },
			{ path: '*', element: <Navigate to={ROUTES.chat} replace /> },
		],
	},
])
