import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { DAY_QUERY_KEY } from '@/entities/day'
import { MESSAGES_QUERY_KEY, replaceFeedMessage } from '@/entities/message'
import { getApiError } from '@/shared/api'
import { useToast } from '@/shared/ui'

import { postClarificationAnswer } from '../api/answer-clarification'
import { getAnswerErrorKey } from '../lib/get-answer-error-key'

export interface PendingAnswer {
	clarificationId: string
	optionIndex: number
}

export interface AnswerClarification {
	answer: (params: PendingAnswer) => void
	/** The tap being saved: its option shows as chosen right away. */
	pending: PendingAnswer | null
}

export const useAnswerClarification = (): AnswerClarification => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()
	const mutation = useMutation({
		mutationFn: postClarificationAnswer,
		onSuccess: (message) => {
			replaceFeedMessage(queryClient, message)
			void queryClient.invalidateQueries({ queryKey: DAY_QUERY_KEY })
		},
		onError: (error) => {
			toast.show(t(getAnswerErrorKey(getApiError(error))))
			// answered elsewhere or gone: the feed shows the real state
			void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
		},
	})

	return {
		answer: (params) => {
			if (mutation.isPending) return
			mutation.mutate(params)
		},
		pending: mutation.isPending ? mutation.variables : null,
	}
}
