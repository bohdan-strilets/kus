import { useTranslation } from 'react-i18next'

import { DevSection } from '../DevSection'
import { DialogsDemo } from './DialogsDemo'
import { SheetsDemo } from './SheetsDemo'

export const OverlaysSection = () => {
	const { t } = useTranslation()

	return (
		<DevSection title={t('devUi.sections.overlays')}>
			<SheetsDemo />
			<DialogsDemo />
		</DevSection>
	)
}
