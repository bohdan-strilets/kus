import { useTranslation } from 'react-i18next'

import { Button, Hamster, Heading, Text } from '@/shared/ui'

const HAMSTER_SIZE = 140

/** mockups/training-home.html, empty: the warm-up hamster, what will appear here, the way to the chat. */
export const TrainingEmpty = ({ onAction }: { onAction: () => void }) => {
	const { t } = useTranslation()

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-8 text-center">
			<Hamster mood="warmup" size={HAMSTER_SIZE} />
			<Heading as="h2" level="title">
				{t('training.journal.empty.title')}
			</Heading>
			<Text tone="mutedStrong">{t('training.journal.empty.text')}</Text>
			<Button onClick={onAction}>{t('training.journal.empty.action')}</Button>
		</div>
	)
}
