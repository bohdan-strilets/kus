import { useTranslation } from 'react-i18next'

import { Button, Hamster, Heading, Text } from '@/shared/ui'

const HAMSTER_SIZE = 120

/** No trainings in the period (the screen's own empty state, no mockup): the way to the chat. */
export const StatsEmpty = ({ onAction }: { onAction: () => void }) => {
	const { t } = useTranslation()

	return (
		<div className="flex flex-col items-center gap-3.5 px-6 py-8 text-center">
			<Hamster mood="warmup" size={HAMSTER_SIZE} />
			<Heading as="h2" level="title">
				{t('training.stats.empty.title')}
			</Heading>
			<Text tone="mutedStrong">{t('training.stats.empty.text')}</Text>
			<Button onClick={onAction}>{t('training.journal.empty.action')}</Button>
		</div>
	)
}
