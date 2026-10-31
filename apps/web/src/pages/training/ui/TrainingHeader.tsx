import { useTranslation } from 'react-i18next'

import { Heading, Text } from '@/shared/ui'

/** mockups/training-home.html header: «Тренування»; with nothing trained yet, the week line over it. */
export const TrainingHeader = ({ isEmpty }: { isEmpty: boolean }) => {
	const { t } = useTranslation()

	return (
		<header className="flex flex-col gap-0.5 px-5 pt-5.5 pb-2.5">
			{isEmpty && (
				<Text as="span" variant="caption" weight="regular" tone="muted">
					{t('training.journal.week.noneInHeader')}
				</Text>
			)}
			<Heading as="h1">{t('pages.training.title')}</Heading>
		</header>
	)
}
