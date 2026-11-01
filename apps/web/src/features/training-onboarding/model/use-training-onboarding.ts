import type { ChatMessage } from '@kus/shared'
import { useMutation, type UseMutationResult, useQueryClient } from '@tanstack/react-query'

import { MESSAGES_QUERY_KEY } from '@/entities/message'
import { PROFILE_QUERY_KEY } from '@/entities/profile'

import { dismissTrainingOnboarding, startTrainingOnboarding } from '../api/training-onboarding'

interface TrainingOnboardingActions {
	start: UseMutationResult<ChatMessage, Error, void>
	dismiss: UseMutationResult<void, Error, void>
}

/**
 * Start and dismiss of the training onboarding. Both change messages of the chat (a question
 * appears, the invitation closes) and the answered mark of the profile, so both are read again — also after a failure, as the
 * question may be closed already. The answers go through useSendMessage with `onboardingAnswer`.
 */
export const useTrainingOnboarding = (): TrainingOnboardingActions => {
	const queryClient = useQueryClient()
	const refreshFeed = (): void => {
		void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
		// the profile carries trainingOnboardingAt, which the «Тренування» tab invites by
		void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY })
	}

	const start = useMutation({
		mutationFn: startTrainingOnboarding,
		onSuccess: refreshFeed,
		onError: refreshFeed,
	})
	const dismiss = useMutation({
		mutationFn: dismissTrainingOnboarding,
		onSuccess: refreshFeed,
		onError: refreshFeed,
	})

	return { start, dismiss }
}
