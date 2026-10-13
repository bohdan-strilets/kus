import { useTranslation } from 'react-i18next'

import { Button, Surface, Text } from '@/shared/ui'

import { useRecordWeight } from '../model/use-record-weight'

/** Food is there, weight never was: a soft invitation in place of the weight card. */
export const WeightCta = () => {
	const { t } = useTranslation()
	const recordWeight = useRecordWeight()

	return (
		<Surface variant="list" radius="panel" className="flex flex-col items-start gap-2.5 p-4">
			<Text as="span" variant="caption" tone="muted">
				{t('progress.weight.label')}
			</Text>
			<Text tone="mutedStrong">{t('progress.weightCta.text')}</Text>
			<Button size="md" onClick={recordWeight}>
				{t('progress.weightCta.action')}
			</Button>
		</Surface>
	)
}
