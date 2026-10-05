export const ROUTES = {
	chat: '/chat',
	today: '/today',
	progress: '/progress',
	recipes: '/recipes',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]
