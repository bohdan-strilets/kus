import {
	BookOpenIcon,
	CalendarDotsIcon,
	ChartLineUpIcon,
	ChatCircleDotsIcon,
	type Icon,
} from '@phosphor-icons/react'

import { type RoutePath, ROUTES } from '@/shared/config'

export interface NavItem {
	to: RoutePath
	labelKey: 'nav.chat' | 'nav.today' | 'nav.progress' | 'nav.recipes'
	icon: Icon
}

export const NAV_ITEMS: readonly NavItem[] = [
	{ to: ROUTES.chat, labelKey: 'nav.chat', icon: ChatCircleDotsIcon },
	{ to: ROUTES.today, labelKey: 'nav.today', icon: CalendarDotsIcon },
	{ to: ROUTES.progress, labelKey: 'nav.progress', icon: ChartLineUpIcon },
	{ to: ROUTES.recipes, labelKey: 'nav.recipes', icon: BookOpenIcon },
]
