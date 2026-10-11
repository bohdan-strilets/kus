import { NavLink } from 'react-router'

import type { NavItem } from '../model/nav-items'
import { navTabVariants } from './bottom-nav.variants'
import { NavTabContent } from './NavTabContent'

interface BottomNavItemProps {
	item: NavItem
	/** Dot badge; the tab's accessible name then comes from `updateLabel`. */
	hasUpdate?: boolean
	/** e.g. «Прогрес, новий підсумок тижня» (mockups). */
	updateLabel?: string
	/** eaten / goal for the «Сьогодні» ring. */
	todayProgress: number
}

/** One tab as a route link; the active state comes from the router. */
export const BottomNavItem = ({
	item,
	hasUpdate = false,
	updateLabel,
	todayProgress,
}: BottomNavItemProps) => (
	<NavLink
		to={item.to}
		// tabs switch in place, as in a native app: Back never flips between them
		replace
		// «Чат» is /app itself: without `end` it would be active under every /app/* tab
		end
		aria-label={hasUpdate ? updateLabel : undefined}
		className={({ isActive }) => navTabVariants({ isActive })}
	>
		{({ isActive }) => (
			<NavTabContent
				item={item}
				isActive={isActive}
				todayProgress={todayProgress}
				hasUpdate={hasUpdate}
			/>
		)}
	</NavLink>
)
