import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { invalidateGoalQueries, isProfileIncompleteError } from '@/entities/goals'
import { ROUTES } from '@/shared/config'
import { playSound } from '@/shared/lib'
import { useToast } from '@/shared/ui'

import { putCalculatedGoals } from '../api/put-calculated-goals'

export interface SaveCalculatedGoals {
	save: () => void
	isSaving: boolean
}

/** Saved → toast and back to the profile; an incomplete profile → «Мої дані». */
export const useSaveCalculatedGoals = (): SaveCalculatedGoals => {
	const { t } = useTranslation()
	const toast = useToast()
	const navigate = useNavigate()
	const queryClient = useQueryClient()

	const mutation = useMutation({
		mutationFn: putCalculatedGoals,
		onSuccess: async () => {
			await invalidateGoalQueries(queryClient)
			playSound('saved')
			toast.show(t('recalcGoals.saved'))
			void navigate(ROUTES.profile, { replace: true })
		},
		onError: (error: unknown) => {
			if (isProfileIncompleteError(error)) {
				toast.show(t('errors.api.PROFILE_INCOMPLETE'))
				void navigate(ROUTES.profileData, { replace: true })
				return
			}
			toast.show(t('goal.saveError'))
		},
	})

	const save = (): void => {
		mutation.mutate()
	}

	return { save, isSaving: mutation.isPending }
}
