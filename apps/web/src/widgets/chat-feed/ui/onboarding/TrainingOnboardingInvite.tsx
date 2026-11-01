import { useTranslation } from 'react-i18next'

import { getOnboardingActionError, useTrainingOnboarding } from '@/features/training-onboarding'
import { getApiError } from '@/shared/api'
import { Button, useToast } from '@/shared/ui'

/** «Це перше тренування в Kusik.» (mockups/training-onboarding.html, entry 2): inside Kusik's reply, with «Так» / «Пізніше». */
export const TrainingOnboardingInvite = () => {
	const { t } = useTranslation()
	const toast = useToast()
	const { start, dismiss } = useTrainingOnboarding()
	const isPending = start.isPending || dismiss.isPending
	const handleError = (error: Error): void => {
		toast.show(getOnboardingActionError(getApiError(error), t))
	}

	return (
		<div className="flex flex-col gap-2 rounded-tile bg-hint-training-bg p-3 text-hint-training-ink">
			<p className="text-card-title font-medium">
				<b className="font-extrabold">{t('trainingOnboarding.invite.title')}</b>{' '}
				{t('trainingOnboarding.invite.text')}
			</p>
			<div className="flex gap-2">
				<Button
					size="md"
					className="min-h-tap flex-1"
					isLoading={start.isPending}
					disabled={isPending}
					onClick={() => {
						start.mutate(undefined, { onError: handleError })
					}}
				>
					{t('trainingOnboarding.invite.yes')}
				</Button>
				<Button
					size="md"
					variant="secondary"
					className="min-h-tap flex-1 bg-surface"
					isLoading={dismiss.isPending}
					disabled={isPending}
					onClick={() => {
						dismiss.mutate(undefined, { onError: handleError })
					}}
				>
					{t('trainingOnboarding.invite.later')}
				</Button>
			</div>
		</div>
	)
}
