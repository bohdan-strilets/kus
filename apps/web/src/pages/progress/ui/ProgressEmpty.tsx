import { useTranslation } from 'react-i18next'

import { Button, Hamster, Heading, Text } from '@/shared/ui'

import { useRecordWeight } from '../model/use-record-weight'

const HAMSTER_SIZE = 140

/** mockups/progress-empty.html: what will appear here and one way forward (weight in the chat). */
export const ProgressEmpty = () => {
	const { t } = useTranslation()
	const recordWeight = useRecordWeight()

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-8 text-center">
			<Hamster mood="hungry" size={HAMSTER_SIZE} />
			<Heading as="h2" level="title">
				{t('progress.empty.title')}
			</Heading>
			<Text tone="mutedStrong">{t('progress.empty.text')}</Text>
			<Button onClick={recordWeight}>{t('progress.empty.action')}</Button>
		</div>
	)
}
