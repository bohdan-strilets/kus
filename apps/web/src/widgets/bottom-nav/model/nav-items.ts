import type { ComponentType } from 'react'

import { type RoutePath, ROUTES } from '@/shared/config'
import {
	NavChatIcon,
	type NavIconProps,
	NavProgressIcon,
	NavRecipesIcon,
	NavTodayIcon,
} from '@/shared/ui'

export interface NavItem {
	to: RoutePath
	labelKey: 'nav.chat' | 'nav.today' | 'nav.progress' | 'nav.recipes'
	/** Brand icons from the mockups (design/CLAUDE-design.md rule 6), with an active variant. */
	icon: ComponentType<NavIconProps>
}

/** Exactly four tabs (design/CLAUDE-design.md rule 2); profile and memory open from the avatar. */
export const NAV_ITEMS: readonly NavItem[] = [
	{ to: ROUTES.chat, labelKey: 'nav.chat', icon: NavChatIcon },
	{ to: ROUTES.today, labelKey: 'nav.today', icon: NavTodayIcon },
	{ to: ROUTES.progress, labelKey: 'nav.progress', icon: NavProgressIcon },
	{ to: ROUTES.recipes, labelKey: 'nav.recipes', icon: NavRecipesIcon },
]
