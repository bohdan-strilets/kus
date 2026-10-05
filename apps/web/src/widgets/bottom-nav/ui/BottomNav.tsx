import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

import { cn } from '@/shared/lib'

import { NAV_ITEMS } from '../model/nav-items'

// Temporary version — rebuilt on top of the design system in roadmap stage 1
export const BottomNav = () => {
	const { t } = useTranslation()

	return (
		<nav
			aria-label={t('nav.label')}
			className="fixed inset-x-0 bottom-0 bg-surface-strong pb-safe-bottom shadow-card backdrop-blur"
		>
			<ul className="mx-auto flex max-w-lg">
				{NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
					<li key={to} className="flex-1">
						<NavLink
							to={to}
							className={({ isActive }) =>
								cn(
									'flex min-h-tap flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold transition-colors',
									isActive ? 'text-accent' : 'text-muted',
								)
							}
						>
							{({ isActive }) => (
								<>
									<Icon aria-hidden size={24} weight={isActive ? 'fill' : 'regular'} />
									{t(labelKey)}
								</>
							)}
						</NavLink>
					</li>
				))}
			</ul>
		</nav>
	)
}
