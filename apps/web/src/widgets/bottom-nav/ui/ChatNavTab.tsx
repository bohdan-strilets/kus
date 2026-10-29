import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

import { Icon, ICON_SIZE } from '@/shared/ui'

import type { NavItem } from '../model/nav-items'
import { chatCircleVariants, chatTabVariants } from './bottom-nav.variants'

/** The brand «bite» on the active circle: two circles in the bar's colour over its top-right edge. */
const CircleBite = () => (
	<>
		<span className="absolute -top-0.75 -right-0.75 size-3.25 rounded-full bg-surface" />
		<span className="absolute top-1.5 -right-1.5 size-2.25 rounded-full bg-surface" />
	</>
)

interface ChatNavTabProps {
	item: NavItem
	/** A static picture (dev boards) is not a link. */
	isStatic?: boolean
	isActive?: boolean
}

/**
 * «Чат» of the five-tab bar (nav-5-tabs): a 56 circle raised 30 px over the bar. Active — solid
 * primary with the filled bubble and the bite, otherwise primary-soft with the outline bubble.
 */
export const ChatNavTab = ({ item, isStatic = false, isActive = false }: ChatNavTabProps) => {
	const { t } = useTranslation()
	const { icon } = item
	if (icon === 'progressRing') return null

	const renderContent = (active: boolean) => (
		<>
			<span className={chatCircleVariants({ isActive: active })}>
				<Icon
					name={active ? icon.activeName : icon.name}
					size={ICON_SIZE.navCenter}
					className="relative [--icon-cutout:var(--color-primary)]"
				/>
				{active && <CircleBite />}
			</span>
			{t(item.labelKey)}
		</>
	)

	if (isStatic) {
		return <div className={chatTabVariants({ isActive })}>{renderContent(isActive)}</div>
	}
	return (
		// «Чат» is /app itself: without `end` it would be active under every /app/* tab
		<NavLink
			to={item.to}
			replace
			end
			className={({ isActive: active }) => chatTabVariants({ isActive: active })}
		>
			{({ isActive: active }) => renderContent(active)}
		</NavLink>
	)
}
