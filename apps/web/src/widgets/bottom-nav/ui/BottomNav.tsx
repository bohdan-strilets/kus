import { useTranslation } from 'react-i18next'

import { ROUTES } from '@/shared/config'

import { NAV_ITEMS } from '../model/nav-items'
import { BottomNavItem } from './BottomNavItem'

interface BottomNavProps {
	/** A new weekly summary is ready: dot on «Прогрес». The data source arrives with stage 6. */
	hasProgressUpdate?: boolean
	/** eaten / goal, fills the «Сьогодні» tab ring; 0 until the day's stats arrive (stage 4). */
	todayProgress?: number
}

/**
 * The floating tab bar from the mockups: radius 30, white 94%, shadow-float, 16px from the sides
 * and 20px above the home indicator, inside the 480px app column.
 */
export const BottomNav = ({ hasProgressUpdate = false, todayProgress = 0 }: BottomNavProps) => {
	const { t } = useTranslation()

	return (
		<div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-app px-gutter pb-safe-bottom">
			<nav
				aria-label={t('nav.label')}
				className="mb-5 rounded-nav bg-surface/94 p-1.5 shadow-float"
			>
				<ul className="grid grid-cols-4 items-center">
					{NAV_ITEMS.map((item) => (
						<li key={item.to}>
							<BottomNavItem
								item={item}
								hasUpdate={item.to === ROUTES.progress && hasProgressUpdate}
								updateLabel={t('nav.progressWithUpdate')}
								todayProgress={todayProgress}
							/>
						</li>
					))}
				</ul>
			</nav>
		</div>
	)
}
