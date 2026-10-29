import { FEATURES, ROUTES, type TabRoutePath } from '@/shared/config'

import { getNavItems } from '../model/nav-items'
import { navBarVariants, navTabVariants } from './bottom-nav.variants'
import { ChatNavTab } from './ChatNavTab'
import { NavTabContent } from './NavTabContent'

interface BottomNavPreviewProps {
	/** The tab drawn as active, whatever the current route. */
	activeTo: TabRoutePath
	todayProgress: number
	hasTraining?: boolean
}

/**
 * A static picture of the bar for /dev/ui state boards (design/mockups/brand-nav-states.html):
 * no links and no shared pill animation, so several bars can sit on one page.
 */
export const BottomNavPreview = ({
	activeTo,
	todayProgress,
	hasTraining = FEATURES.workouts,
}: BottomNavPreviewProps) => (
	<div aria-hidden="true" className={navBarVariants()}>
		<div className={hasTraining ? 'grid grid-cols-5 items-end' : 'grid grid-cols-4 items-center'}>
			{getNavItems(hasTraining).map((item) => {
				const isActive = item.to === activeTo
				if (hasTraining && item.to === ROUTES.chat) {
					return <ChatNavTab key={item.to} item={item} isStatic isActive={isActive} />
				}
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
