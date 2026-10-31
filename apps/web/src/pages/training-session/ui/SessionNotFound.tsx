import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { ROUTES } from '@/shared/config'
import { Button, Hamster, Heading, Text } from '@/shared/ui'

const HAMSTER_SIZE = 120

/** No mockup: the empty-state pattern of the training tab. The training is gone, deleted or never was. */
export const SessionNotFound = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-8 text-center">
			<Hamster mood="oops" size={HAMSTER_SIZE} />
			<Heading as="h2" level="title">
				{t('training.session.notFound.title')}
			</Heading>
			<Text tone="mutedStrong">{t('training.session.notFound.text')}</Text>
			<Button
				onClick={() => {
					void navigate(ROUTES.training, { replace: true })
				}}
			>
				{t('training.session.notFound.action')}
			</Button>
		</div>
	)
}
