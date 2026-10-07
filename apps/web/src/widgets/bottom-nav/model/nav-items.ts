import { type RoutePath, ROUTES } from '@/shared/config'
import type { IconName } from '@/shared/ui'

/** A pack icon with its `-filled` active variant, or the «Сьогодні» ring that fills with the day. */
export type NavItemIcon = { name: IconName; activeName: IconName } | 'progressRing'

export interface NavItem {
	to: RoutePath
	labelKey: 'nav.chat' | 'nav.today' | 'nav.progress' | 'nav.recipes'
	icon: NavItemIcon
}

/** Exactly four tabs (design/CLAUDE-design.md rule 2); profile and memory open from the avatar. */
export const NAV_ITEMS: readonly NavItem[] = [
	{ to: ROUTES.chat, labelKey: 'nav.chat', icon: { name: 'chat', activeName: 'chat-filled' } },
	{ to: ROUTES.today, labelKey: 'nav.today', icon: 'progressRing' },
	{
		to: ROUTES.progress,
		labelKey: 'nav.progress',
		icon: { name: 'progress', activeName: 'progress-filled' },
	},
	{
		to: ROUTES.recipes,
		labelKey: 'nav.recipes',
		icon: { name: 'recipes', activeName: 'recipes-filled' },
	},
]
