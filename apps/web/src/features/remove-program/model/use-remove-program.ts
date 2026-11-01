import { useMutation, type UseMutationResult, useQueryClient } from '@tanstack/react-query'

import { MESSAGES_QUERY_KEY } from '@/entities/message'
import { PROGRAM_QUERY_KEY, setActiveProgram } from '@/entities/program'

import { removeProgram } from '../api/remove-program'

/**
 * DELETE /programs/active. The cached program becomes «none» at once, the feed is read again (its
 * cards turn OUTDATED). A failure reads the program: it may be gone already.
 */
export const useRemoveProgram = (): UseMutationResult<void, Error, void> => {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: removeProgram,
		onSuccess: () => {
			setActiveProgram(queryClient, null)
			void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
		},
		onError: () => {
			void queryClient.invalidateQueries({ queryKey: PROGRAM_QUERY_KEY })
		},
	})
}
