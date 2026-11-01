import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { getOnboardingActionError, useTrainingOnboarding } from '@/features/training-onboarding'
import { getApiError } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { useToast } from '@/shared/ui'

/** «Налаштувати в чаті» / «Налаштувати»: opens the onboarding and goes to the chat where the first question waits. */
export const useStartTrainingSetup = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const toast = useToast()
	const { start, dismiss } = useTrainingOnboarding()

	const handleError = (error: Error): void => {
		toast.show(getOnboardingActionError(getApiError(error), t))
	}

	return {
		isPending: start.isPending || dismiss.isPending,
		isStarting: start.isPending,
		isDismissing: dismiss.isPending,
		startSetup: (): void => {
			if (start.isPending) return
			start.mutate(undefined, {
				onSuccess: () => {
					void navigate(ROUTES.chat)
				},
				onError: handleError,
			})
		},
		dismissInvite: (): void => {
			dismiss.mutate(undefined, { onError: handleError })
		},
	}
}
