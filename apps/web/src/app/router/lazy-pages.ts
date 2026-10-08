import { lazy } from 'react'

// Route-level code splitting (CLAUDE.md §11): each page is its own chunk
export const ChatPage = lazy(() => import('@/pages/chat').then((m) => ({ default: m.ChatPage })))
export const TodayPage = lazy(() => import('@/pages/today').then((m) => ({ default: m.TodayPage })))
export const ProgressPage = lazy(() =>
	import('@/pages/progress').then((m) => ({ default: m.ProgressPage })),
)
export const RecipesPage = lazy(() =>
	import('@/pages/recipes').then((m) => ({ default: m.RecipesPage })),
)
export const ProfilePage = lazy(() =>
	import('@/pages/profile').then((m) => ({ default: m.ProfilePage })),
)
export const LoginPage = lazy(() => import('@/pages/auth').then((m) => ({ default: m.LoginPage })))
export const RegisterPage = lazy(() =>
	import('@/pages/auth').then((m) => ({ default: m.RegisterPage })),
)
