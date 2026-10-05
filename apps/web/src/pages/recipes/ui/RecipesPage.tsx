import { useTranslation } from 'react-i18next'

import { PageStub } from '@/shared/ui'

export const RecipesPage = () => {
	const { t } = useTranslation()

	return <PageStub title={t('pages.recipes.title')} description={t('pages.recipes.placeholder')} />
}
