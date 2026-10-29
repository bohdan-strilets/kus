import { useTranslation } from 'react-i18next'

import { FEATURES, ROUTES } from '@/shared/config'

import { getNavItems } from '../model/nav-items'
import { navBarVariants } from './bottom-nav.variants'
import { BottomNavItem } from './BottomNavItem'
import { ChatNavTab } from './ChatNavTab'

interface BottomNavProps {
	/** A new weekly summary is ready: dot on «Прогрес». The data source arrives with stage 6. */
	hasProgressUpdate?: boolean
	/** eaten / goal, fills the «Сьогодні» tab ring (useTodayProgress); 0 without a goal. */
	todayProgress?: number
	/** Five tabs with the raised «Чат» (nav-5-tabs); the flag decides unless a caller says otherwise. */
	hasTraining?: boolean
}

/**
 * The floating tab bar from the mockups: radius 30, white 94%, shadow-float, 16px from the sides,
 * 20px from the bottom edge or just over the home indicator (the safe area counts once). AppLayout
 * places it at the bottom of the app column and hides it while the keyboard is up.
 */
export const BottomNav = ({
	hasProgressUpdate = false,
	todayProgress = 0,
	hasTraining = FEATURES.workouts,
}: BottomNavProps) => {
	const { t } = useTranslation()

	return (
		<div className="px-gutter pb-nav-bottom">
			<nav aria-label={t('nav.label')} className={navBarVariants()}>
				<ul
					className={hasTraining ? 'grid grid-cols-5 items-end' : 'grid grid-cols-4 items-center'}
				>
					{getNavItems(hasTraining).map((item) => (
						<li key={item.to}>
							{hasTraining && item.to === ROUTES.chat ? (
								<ChatNavTab item={item} />
							) : (
								<BottomNavItem
									item={item}
									hasUpdate={item.to === ROUTES.progress && hasProgressUpdate}
									updateLabel={t('nav.progressWithUpdate')}
									todayProgress={todayProgress}
									isCompact={hasTraining}
								/>
							)}
						</li>
					))}
				</ul>
			</nav>
		</div>
	)
}
