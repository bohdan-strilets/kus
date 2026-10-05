import { useTranslation } from 'react-i18next'

import { PageStub } from '@/shared/ui'

export const TodayPage = () => {
	const { t } = useTranslation()

	return <PageStub title={t('pages.today.title')} description={t('pages.today.placeholder')} />
}
