import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { DAY_QUERY_KEY } from '@/entities/day'
import { MESSAGES_QUERY_KEY } from '@/entities/message'
import { WORKOUTS_QUERY_KEY } from '@/entities/workout'
import { getApiError } from '@/shared/api'
import { useToast } from '@/shared/ui'

import { deleteWorkout } from '../api/delete-workout'
import { getDeleteWorkoutErrorKey } from '../lib/get-delete-error-key'

/**
 * DELETE /workouts/:id. The tab, the day and the chat card refresh from the server (no toast, no
 * undo: the training comes back in words); after a failure they refresh too — it may be gone already.
 */
export const useDeleteWorkout = ({
	onSettled,
}: {
	onSettled?: () => void
} = {}): { remove: (id: string) => void; isDeleting: boolean } => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()
	const refresh = (): void => {
		void queryClient.invalidateQueries({ queryKey: WORKOUTS_QUERY_KEY })
		void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
		void queryClient.invalidateQueries({ queryKey: DAY_QUERY_KEY })
	}
	const mutation = useMutation({
		mutationFn: deleteWorkout,
		onSuccess: () => {
			refresh()
			onSettled?.()
		},
		onError: (error) => {
			toast.show(t(getDeleteWorkoutErrorKey(getApiError(error))))
			refresh()
			onSettled?.()
		},
	})

	return {
		remove: (id) => {
			if (!mutation.isPending) mutation.mutate(id)
		},
		isDeleting: mutation.isPending,
	}
}
