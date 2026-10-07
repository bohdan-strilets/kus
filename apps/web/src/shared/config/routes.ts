/** The four bottom-nav tabs; everything under /app needs a session (design/docs/screens.md). */
export const TAB_ROUTES = {
	chat: '/app',
	today: '/app/today',
	progress: '/app/progress',
	recipes: '/app/recipes',
} as const

export const AUTH_ROUTES = {
	login: '/login',
	register: '/register',
} as const

export const ROUTES = { ...TAB_ROUTES, ...AUTH_ROUTES } as const

export type TabRoutePath = (typeof TAB_ROUTES)[keyof typeof TAB_ROUTES]

/** Registered only in dev builds (see app/router). */
export const DEV_ROUTES = {
	ui: '/dev/ui',
} as const

/** `/app` and everything under it: the routes that need a session. */
export const isProtectedPath = (pathname: string): boolean =>
	pathname === TAB_ROUTES.chat || pathname.startsWith(`${TAB_ROUTES.chat}/`)
