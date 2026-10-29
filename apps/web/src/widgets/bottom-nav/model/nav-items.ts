import { ROUTES, type TabRoutePath } from '@/shared/config'
import type { IconName } from '@/shared/ui'

/** A pack icon with its `-filled` active variant, or the «Сьогодні» ring that fills with the day. */
export type NavItemIcon = { name: IconName; activeName: IconName } | 'progressRing'

export interface NavItem {
	to: TabRoutePath
	labelKey: 'nav.chat' | 'nav.today' | 'nav.progress' | 'nav.recipes' | 'nav.training'
	icon: NavItemIcon
}

const CHAT_ITEM: NavItem = {
	to: ROUTES.chat,
	labelKey: 'nav.chat',
	icon: { name: 'chat', activeName: 'chat-filled' },
}
const TODAY_ITEM: NavItem = { to: ROUTES.today, labelKey: 'nav.today', icon: 'progressRing' }
const PROGRESS_ITEM: NavItem = {
	to: ROUTES.progress,
	labelKey: 'nav.progress',
	icon: { name: 'progress', activeName: 'progress-filled' },
}
const RECIPES_ITEM: NavItem = {
	to: ROUTES.recipes,
	labelKey: 'nav.recipes',
	icon: { name: 'recipes', activeName: 'recipes-filled' },
}
const TRAINING_ITEM: NavItem = {
	to: ROUTES.training,
	labelKey: 'nav.training',
	icon: { name: 'training', activeName: 'training-filled' },
}

/** Four tabs while «Тренування» is off (FEATURES.workouts); profile and memory open from the avatar. */
export const NAV_ITEMS: readonly NavItem[] = [CHAT_ITEM, TODAY_ITEM, PROGRESS_ITEM, RECIPES_ITEM]

/** nav-5-tabs: food on the left, the body on the right, the chat — the raised button — in the middle. */
export const NAV_ITEMS_WITH_TRAINING: readonly NavItem[] = [
	TODAY_ITEM,
	RECIPES_ITEM,
	CHAT_ITEM,
	TRAINING_ITEM,
	PROGRESS_ITEM,
]

export const getNavItems = (hasTraining: boolean): readonly NavItem[] =>
	hasTraining ? NAV_ITEMS_WITH_TRAINING : NAV_ITEMS
