import { useTranslation } from 'react-i18next'

import { Button, Icon, Surface } from '@/shared/ui'

import { DevSection } from '../DevSection'

const RETRY_ICON_SIZE = 16

export const ButtonsSection = () => {
	const { t } = useTranslation()

	return (
		<DevSection title={t('devUi.sections.buttons')}>
			<div className="flex flex-col gap-3">
				<Button isFullWidth>{t('devUi.level0.login')}</Button>
				<Button isFullWidth isLoading loadingText={t('devUi.level0.saving')}>
					{t('devUi.level0.login')}
				</Button>
				<Button variant="secondary" isFullWidth>
					{t('devUi.level0.later')}
				</Button>
				<Button variant="dark" isFullWidth>
					{t('devUi.level0.recalculate')}
				</Button>
				<Button variant="danger" isFullWidth>
					{t('devUi.level0.deleteAll')}
				</Button>
				<Button isFullWidth disabled>
					{t('devUi.level0.disabled')}
				</Button>
				<div className="flex flex-wrap items-center gap-2">
					<Button size="md" icon={<Icon name="retry" size={RETRY_ICON_SIZE} />}>
						{t('devUi.level0.retry')}
					</Button>
					<Button variant="secondary" size="sm">
						{t('devUi.level0.edit')}
					</Button>
					<Button variant="secondary" size="sm" isLoading>
						{t('devUi.level0.edit')}
					</Button>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Surface radius="tile" shadow="chip" className="px-2">
						<Button variant="text">{t('devUi.level0.exportFirst')}</Button>
					</Surface>
					<Button variant="textOnBackground" size="sm">
						{t('devUi.level0.forgot')}
					</Button>
					<Button variant="textDanger">{t('devUi.level0.logout')}</Button>
				</div>
			</div>
		</DevSection>
	)
}
