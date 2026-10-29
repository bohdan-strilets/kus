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
 * `isDeleting` lasts until that refresh is done.
 */
export const useDeleteWorkout = ({
	onSettled,
}: {
	onSettled?: () => void
} = {}): { remove: (id: string) => void; isDeleting: boolean } => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()
	/** Resolves when the tab, the chat and the day have read the server again. */
	const refresh = async (): Promise<void> => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: WORKOUTS_QUERY_KEY }),
			queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY }),
			queryClient.invalidateQueries({ queryKey: DAY_QUERY_KEY }),
		])
	}
	// onSettled (the dialog closes) goes first; the mutation then stays pending until the refetch is
	// done, so `isDeleting` covers the whole time the card still shows the old state
	const mutation = useMutation({
		mutationFn: deleteWorkout,
		onSuccess: async () => {
			onSettled?.()
			await refresh()
		},
		onError: async (error) => {
			toast.show(t(getDeleteWorkoutErrorKey(getApiError(error))))
			onSettled?.()
			await refresh()
		},
	})

	return {
		remove: (id) => {
			if (!mutation.isPending) mutation.mutate(id)
		},
		isDeleting: mutation.isPending,
	}
}
