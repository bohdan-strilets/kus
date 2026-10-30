import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FACTS_QUERY_KEY } from '@/entities/fact'
import { MESSAGES_QUERY_KEY } from '@/entities/message'
import { getApiError } from '@/shared/api'
import { playSound } from '@/shared/lib'
import { useToast } from '@/shared/ui'

import { answerFact } from '../api/answer-fact'
import { getAnswerErrorOutcome } from '../lib/get-answer-error'

export interface FactProposalAnswer {
	answer: (accept: boolean) => void
	isPending: boolean
	/** The choice in flight: its button shows the loader. */
	pendingAccept: boolean | null
	/** The limit sentence for the plaque; null when there is nothing to say. */
	notice: string | null
}

/** «Так» / «Ні» on a fact proposal: both the feed and «Про тебе» are reloaded after the answer. */
export const useAnswerFactProposal = (factId: string): FactProposalAnswer => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()
	const [notice, setNotice] = useState<string | null>(null)

	const refresh = (): void => {
		void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
		void queryClient.invalidateQueries({ queryKey: FACTS_QUERY_KEY })
	}

	const mutation = useMutation({
		mutationFn: answerFact,
		onMutate: () => {
			setNotice(null)
		},
		onSuccess: (_fact, { accept }) => {
			// the sound goes with the «Запам'ятав» line that the reloaded feed shows
			if (accept) playSound('saved')
			refresh()
		},
		onError: (error) => {
			const outcome = getAnswerErrorOutcome(getApiError(error), t)
			setNotice(outcome.notice)
			if (outcome.toast !== null) toast.show(outcome.toast)
			if (outcome.shouldRefresh) refresh()
		},
	})

	return {
		answer: (accept) => {
			if (mutation.isPending) return
			mutation.mutate({ id: factId, accept })
		},
		isPending: mutation.isPending,
		pendingAccept: mutation.isPending ? mutation.variables.accept : null,
		notice,
	}
}
