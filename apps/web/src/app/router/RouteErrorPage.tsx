import { useTranslation } from 'react-i18next'

import { PageStub, RetryButton } from '@/shared/ui'

const reloadPage = (): void => {
	window.location.reload()
}

/**
 * Render or lazy-chunk failure. After a new deploy an old cached index may request chunks
 * that no longer exist, and a full reload fetches the new build.
 */
export const RouteErrorPage = () => {
	const { t } = useTranslation()

	return (
		<div role="alert">
			<PageStub title={t('errors.route.title')} description={t('errors.route.description')}>
				<div>
					<RetryButton label={t('errors.route.reload')} onClick={reloadPage} />
				</div>
			</PageStub>
		</div>
	)
}
