import { useTranslation } from 'react-i18next'

import { LogoutButton } from '@/features/logout'
import { PageStub } from '@/shared/ui'

/** Behind the chat avatar. The real screen (mockups/profile.html) comes with stage 6; until then «Вийти» lives here. */
export const ProfilePage = () => {
	const { t } = useTranslation()

	return (
		<PageStub title={t('pages.profile.title')} description={t('pages.profile.placeholder')}>
			<LogoutButton />
		</PageStub>
	)
}
