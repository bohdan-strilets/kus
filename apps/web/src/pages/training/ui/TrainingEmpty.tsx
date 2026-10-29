import { useTranslation } from 'react-i18next'

import { Button, Hamster, Heading, Text } from '@/shared/ui'

const HAMSTER_SIZE = 140

/** mockups/training-tab.html, empty: what will appear here and the way to the chat. */
export const TrainingEmpty = ({ onAction }: { onAction: () => void }) => {
	const { t } = useTranslation()

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-8 text-center">
			<Hamster mood="proud" size={HAMSTER_SIZE} />
			<Heading as="h2" level="title">
				{t('training.empty.title')}
			</Heading>
			<Text tone="mutedStrong">{t('training.empty.text')}</Text>
			<Button onClick={onAction}>{t('training.empty.action')}</Button>
		</div>
	)
}
