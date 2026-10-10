import { useTranslation } from 'react-i18next'

import { useSessionUser } from '@/entities/session'
import { AddressForm } from '@/features/edit-address'
import { LogoutButton } from '@/features/logout'
import { PageStub } from '@/shared/ui'

/**
 * Behind the chat avatar. The real screen (mockups/profile.html) comes with stage 6; until then
 * «Як до тебе звертатися?» and «Вийти» live here.
 */
export const ProfilePage = () => {
	const { t } = useTranslation()
	const user = useSessionUser()

	return (
		<PageStub title={t('pages.profile.title')} description="">
			{user && <AddressForm addressAs={user.addressAs} />}
			<LogoutButton />
		</PageStub>
	)
}
