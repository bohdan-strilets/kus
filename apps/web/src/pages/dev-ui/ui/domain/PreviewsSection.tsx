import { useTranslation } from 'react-i18next'

import { DevSection } from '../DevSection'
import { ChatPreviews } from './previews/ChatPreviews'
import { TodayPreviews } from './previews/TodayPreviews'

export const PreviewsSection = () => {
	const { t } = useTranslation()

	return (
		<DevSection title={t('devUi.sections.previews')}>
			<ChatPreviews />
			<TodayPreviews />
		</DevSection>
	)
}
