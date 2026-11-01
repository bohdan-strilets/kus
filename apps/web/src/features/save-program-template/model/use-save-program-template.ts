import type { ProgramResponse, SaveTemplateRequest } from '@kus/shared'
import { useMutation, type UseMutationResult, useQueryClient } from '@tanstack/react-query'

import { MESSAGES_QUERY_KEY } from '@/entities/message'
import { PROGRAM_QUERY_KEY, setActiveProgram } from '@/entities/program'
import { EXERCISE_DICTIONARY_QUERY_KEY } from '@/entities/workout'

import { saveProgramTemplate } from '../api/save-program-template'

/**
 * A new version replaces the cached program. The open cards in the chat may become OUTDATED, so
 * the feed is read again; a PROGRAM_VERSION_CONFLICT refreshes the program for the screen to merge.
 */
export const useSaveProgramTemplate = (): UseMutationResult<
	ProgramResponse,
	Error,
	SaveTemplateRequest
> => {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: saveProgramTemplate,
		onSuccess: (program) => {
			setActiveProgram(queryClient, program)
			void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
			// a new exercise of the template joins the user's dictionary
			void queryClient.invalidateQueries({ queryKey: EXERCISE_DICTIONARY_QUERY_KEY })
		},
		onError: () => {
			void queryClient.invalidateQueries({ queryKey: PROGRAM_QUERY_KEY })
		},
	})
}
