import type {
	ProgramResponse,
	UpdateProgramSettingsRequest,
	UpdateTemplateScheduleRequest,
} from '@kus/shared'
import { useMutation, type UseMutationResult, useQueryClient } from '@tanstack/react-query'

import { PROGRAM_QUERY_KEY, setActiveProgram } from '@/entities/program'

import { updateProgramSettings, updateTemplateWeekdays } from '../api/update-program-settings'

interface ProgramSettingsActions {
	updateSettings: UseMutationResult<ProgramResponse, Error, UpdateProgramSettingsRequest>
	updateWeekdays: UseMutationResult<
		ProgramResponse,
		Error,
		UpdateTemplateScheduleRequest & { templateId: string }
	>
}

/**
 * Both answer with the whole program, which replaces the cached one (the «next» template and the
 * schedule move with the settings). A failure reads the program again: the screen may be stale.
 */
export const useUpdateProgramSettings = (): ProgramSettingsActions => {
	const queryClient = useQueryClient()
	const onSuccess = (program: ProgramResponse): void => {
		setActiveProgram(queryClient, program)
	}
	const onError = (): void => {
		void queryClient.invalidateQueries({ queryKey: PROGRAM_QUERY_KEY })
	}

	const updateSettings = useMutation({ mutationFn: updateProgramSettings, onSuccess, onError })
	const updateWeekdays = useMutation({ mutationFn: updateTemplateWeekdays, onSuccess, onError })

	return { updateSettings, updateWeekdays }
}
