import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { TRAINING_STATS_ROUTE } from '@/shared/config'
import { Button, Hamster, Heading, Text } from '@/shared/ui'

const HAMSTER_SIZE = 120

/** No mockup: the empty-state pattern of the session screen. The exercise is gone or never was. */
export const ExerciseNotFound = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-8 text-center">
			<Hamster mood="oops" size={HAMSTER_SIZE} />
			<Heading as="h2" level="title">
				{t('training.stats.exercise.notFound.title')}
			</Heading>
			<Text tone="mutedStrong">{t('training.stats.exercise.notFound.text')}</Text>
			<Button
				onClick={() => {
					void navigate(TRAINING_STATS_ROUTE, { replace: true })
				}}
			>
				{t('training.stats.exercise.notFound.action')}
			</Button>
		</div>
	)
}
