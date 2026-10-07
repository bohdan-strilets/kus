import type { RoutePath } from '@/shared/config'

import { NAV_ITEMS } from '../model/nav-items'
import { navBarVariants, navTabVariants } from './bottom-nav.variants'
import { NavTabContent } from './NavTabContent'

interface BottomNavPreviewProps {
	/** The tab drawn as active, whatever the current route. */
	activeTo: RoutePath
	todayProgress: number
}

/**
 * A static picture of the bar for /dev/ui state boards (design/mockups/brand-nav-states.html):
 * no links and no shared pill animation, so several bars can sit on one page.
 */
export const BottomNavPreview = ({ activeTo, todayProgress }: BottomNavPreviewProps) => (
	<div aria-hidden="true" className={navBarVariants()}>
		<div className="grid grid-cols-4 items-center">
			{NAV_ITEMS.map((item) => {
				const isActive = item.to === activeTo
				return (
					<div key={item.to} className={navTabVariants({ isActive })}>
						<NavTabContent
							item={item}
							isActive={isActive}
							todayProgress={todayProgress}
							isPillShared={false}
						/>
					</div>
				)
			})}
		</div>
	</div>
)
