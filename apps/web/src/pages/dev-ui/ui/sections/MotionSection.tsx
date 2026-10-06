import { useTranslation } from 'react-i18next'

import { ChatMotionDemos } from '../demos/ChatMotionDemos'
import { DataMotionDemos } from '../demos/DataMotionDemos'
import { OverlayMotionDemos } from '../demos/OverlayMotionDemos'
import { DevSection } from '../DevSection'

export const MotionSection = () => {
	const { t } = useTranslation()

	return (
		<DevSection title={t('devUi.sections.motion')} hint={t('devUi.reducedMotionHint')}>
			<ChatMotionDemos />
			<OverlayMotionDemos />
			<DataMotionDemos />
		</DevSection>
	)
}
