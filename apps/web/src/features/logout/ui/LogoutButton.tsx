import { useTranslation } from 'react-i18next'

import { Icon, ICON_SIZE, IconButton } from '@/shared/ui'

import { useLogout } from '../model/use-logout'

/** Temporary: lives in the /app header until the profile screen (with «Вийти») exists. */
export const LogoutButton = () => {
	const { t } = useTranslation()
	const { logout, isPending } = useLogout()

	return (
		<IconButton
			variant="frosted"
			label={t('auth.logout')}
			disabled={isPending}
			aria-busy={isPending || undefined}
			onClick={logout}
		>
			<Icon name="logout" size={ICON_SIZE.control} />
		</IconButton>
	)
}
