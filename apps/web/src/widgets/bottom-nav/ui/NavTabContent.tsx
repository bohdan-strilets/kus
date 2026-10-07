import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { Badge, Icon, ICON_SIZE, ProgressRingIcon } from '@/shared/ui'

import { NAV_PILL_LAYOUT_ID, NAV_PILL_TRANSITION } from '../model/bottom-nav.constants'
import type { NavItem } from '../model/nav-items'

interface NavTabContentProps {
	item: NavItem
	isActive: boolean
	/** eaten / goal for the «Сьогодні» ring. */
	todayProgress: number
	hasUpdate?: boolean
	/** The real nav slides one pill between tabs; static previews draw a pill per bar. */
	isPillShared?: boolean
}

/** The brand «bite»: two white circles clipped by the pill's top-right corner. */
const PillBite = () => (
	<>
		<span className="absolute -top-1.25 -right-1.25 size-3.25 rounded-full bg-white" />
		<span className="absolute top-0.75 -right-1.75 size-2.25 rounded-full bg-white" />
	</>
)

const PILL_CLASS = 'absolute inset-0 overflow-hidden rounded-full bg-primary-soft'

/**
 * Inside of a tab (design/docs/components.md BottomNav): the 54×30 primary-soft pill with the bite
 * on the active tab, the icon (outline / `-filled`, ProgressRingIcon on «Сьогодні») and the label.
 */
export const NavTabContent = ({
	item,
	isActive,
	todayProgress,
	hasUpdate = false,
	isPillShared = true,
}: NavTabContentProps) => {
	const { t } = useTranslation()
	const { labelKey, icon } = item

	return (
		<>
			<span className="relative flex h-7.5 w-13.5 items-center justify-center">
				{isActive &&
					(isPillShared ? (
						<motion.span
							layoutId={NAV_PILL_LAYOUT_ID}
							transition={NAV_PILL_TRANSITION}
							aria-hidden="true"
							className={PILL_CLASS}
						>
							<PillBite />
						</motion.span>
					) : (
						<span aria-hidden="true" className={PILL_CLASS}>
							<PillBite />
						</span>
					))}
				{icon === 'progressRing' ? (
					<ProgressRingIcon progress={todayProgress} isActive={isActive} className="relative" />
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
	)
}
