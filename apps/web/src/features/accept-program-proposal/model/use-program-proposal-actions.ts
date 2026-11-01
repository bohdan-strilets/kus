import type { ProgramResponse, RebaseProgramProposalResponse } from '@kus/shared'
import { useMutation, type UseMutationResult, useQueryClient } from '@tanstack/react-query'

import { MESSAGES_QUERY_KEY, replaceFeedMessage } from '@/entities/message'
import { PROGRAM_QUERY_KEY, setActiveProgram } from '@/entities/program'

import { acceptProgramProposal, rebaseProgramProposal } from '../api/program-proposal'

interface ProgramProposalActions {
	accept: UseMutationResult<ProgramResponse, Error, string>
	rebase: UseMutationResult<RebaseProgramProposalResponse, Error, string>
}

/**
 * «Прийняти» and «Перерахувати» on a program card. Either way the feed is read again (the card's
 * status is derived by the server); a failure refreshes too — the card may be outdated by now.
 */
export const useProgramProposalActions = (): ProgramProposalActions => {
	const queryClient = useQueryClient()
	const refreshFeed = (): void => {
		void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
	}

	const accept = useMutation({
		mutationFn: acceptProgramProposal,
		onSuccess: (program) => {
			setActiveProgram(queryClient, program)
			refreshFeed()
		},
		onError: () => {
			void queryClient.invalidateQueries({ queryKey: PROGRAM_QUERY_KEY })
			refreshFeed()
		},
	})

	const rebase = useMutation({
		mutationFn: rebaseProgramProposal,
		onSuccess: ({ previousMessage }) => {
			// the old card shows its new state at once; the new message arrives with the feed
			replaceFeedMessage(queryClient, previousMessage)
			refreshFeed()
		},
		onError: refreshFeed,
	})

	return { accept, rebase }
}
