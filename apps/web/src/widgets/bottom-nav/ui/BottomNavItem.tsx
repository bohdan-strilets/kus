import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

import { cn } from '@/shared/lib'
import { Badge, Icon, ICON_SIZE, ProgressRingIcon } from '@/shared/ui'

import { NAV_PILL_LAYOUT_ID, NAV_PILL_TRANSITION } from '../model/bottom-nav.constants'
import type { NavItem } from '../model/nav-items'

interface BottomNavItemProps {
	item: NavItem
	/** Dot badge; the tab's accessible name then comes from `updateLabel`. */
	hasUpdate?: boolean
	/** e.g. «Прогрес, новий підсумок тижня» (mockups). */
	updateLabel?: string
	/** eaten / goal for the «Сьогодні» ring. */
	todayProgress: number
}

/**
 * One tab, 1:1 with the nav in design/mockups/chat.html: a 54×30 pill on primary-soft with the
 * brand «bite» (two white circles clipped by the pill's top-right corner), label 12/800 primary;
 * inactive tabs are muted 12/600.
 */
export const BottomNavItem = ({
	item,
	hasUpdate = false,
	updateLabel,
	todayProgress,
}: BottomNavItemProps) => {
	const { t } = useTranslation()
	const { to, labelKey, icon } = item

	return (
		<NavLink
			to={to}
			aria-label={hasUpdate ? updateLabel : undefined}
			className={({ isActive }) =>
				cn(
					'flex min-h-14 flex-col items-center justify-center gap-0.75 rounded-chip text-small transition-colors duration-(--duration-base)',
					isActive ? 'font-extrabold text-primary' : 'font-semibold text-muted',
				)
			}
		>
			{({ isActive }) => (
				<>
					<span className="relative flex h-7.5 w-13.5 items-center justify-center">
						{isActive && (
							<motion.span
								layoutId={NAV_PILL_LAYOUT_ID}
								transition={NAV_PILL_TRANSITION}
								aria-hidden="true"
								className="absolute inset-0 overflow-hidden rounded-full bg-primary-soft"
							>
								<span className="absolute -top-1.25 -right-1.25 size-3.25 rounded-full bg-white" />
								<span className="absolute top-0.75 -right-1.75 size-2.25 rounded-full bg-white" />
							</motion.span>
						)}
						{icon === 'progressRing' ? (
							<ProgressRingIcon progress={todayProgress} className="relative" />
						) : (
							<Icon
								name={isActive ? icon.activeName : icon.name}
								size={ICON_SIZE.nav}
								className="relative"
							/>
						)}
						{hasUpdate && <Badge variant="notice" className="absolute top-0.5 right-2.75" />}
					</span>
					{t(labelKey)}
				</>
			)}
		</NavLink>
	)
}
