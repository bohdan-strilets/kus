import { useTranslation } from 'react-i18next'

import { HealthStatus } from '@/entities/health'
import { PageStub } from '@/shared/ui'

export const ChatPage = () => {
	const { t } = useTranslation()

	return (
		<PageStub title={t('pages.chat.title')} description={t('pages.chat.placeholder')}>
			<HealthStatus />
		</PageStub>
	)
}
