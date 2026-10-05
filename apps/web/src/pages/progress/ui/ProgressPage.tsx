import { useTranslation } from 'react-i18next'

import { PageStub } from '@/shared/ui'

export const ProgressPage = () => {
	const { t } = useTranslation()

	return (
		<PageStub title={t('pages.progress.title')} description={t('pages.progress.placeholder')} />
	)
}
