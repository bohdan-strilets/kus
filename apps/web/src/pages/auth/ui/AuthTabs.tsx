import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router'

import { AUTH_ROUTES } from '@/shared/config'

import { authTabVariants } from './auth-tabs.variants'

/**
 * «Вхід | Реєстрація» from the mockups: two links (NavLink sets aria-current="page"), not tabs —
 * each has its own URL. The guard's «come back to» state travels with the switch.
 */
export const AuthTabs = () => {
	const { t } = useTranslation()
	// history state is untyped; it's only passed along, the guard validates it
	const state: unknown = useLocation().state

	return (
		<nav
			aria-label={t('auth.tabs')}
			className="grid grid-cols-2 gap-1 self-stretch rounded-tile bg-surface/60 p-1"
		>
			<NavLink
				to={AUTH_ROUTES.login}
				state={state}
				replace
				className={({ isActive }) => authTabVariants({ isActive })}
			>
				{t('auth.loginTab')}
			</NavLink>
			<NavLink
				to={AUTH_ROUTES.register}
				state={state}
				replace
				className={({ isActive }) => authTabVariants({ isActive })}
			>
				{t('auth.registerTab')}
			</NavLink>
		</nav>
	)
}
