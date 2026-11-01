import { useTranslation } from 'react-i18next'

import { Button, Hamster, Heading, Text } from '@/shared/ui'

import { useStartTrainingSetup } from '../model/use-start-training-setup'

const HAMSTER_SIZE = 150

/** mockups/training-onboarding.html «Вхід 1 · вкладка»: the first visit without a program or an answer. */
export const TrainingInvite = () => {
	const { t } = useTranslation()
	const { isPending, isStarting, isDismissing, startSetup, dismissInvite } = useStartTrainingSetup()

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pt-10 text-center">
			<Hamster mood="warmup" size={HAMSTER_SIZE} />
			<Heading as="h2" level="title">
				{t('training.invite.title')}
			</Heading>
			<Text tone="mutedStrong">{t('training.invite.text')}</Text>
			<Button className="mt-1.5" isLoading={isStarting} disabled={isPending} onClick={startSetup}>
				{t('training.invite.action')}
			</Button>
			<Button
				variant="textPlain"
				className="underline underline-offset-2"
				isLoading={isDismissing}
				disabled={isPending}
				onClick={dismissInvite}
			>
				{t('training.invite.later')}
			</Button>
		</div>
	)
}
