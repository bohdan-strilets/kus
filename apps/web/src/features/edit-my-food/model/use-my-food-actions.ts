import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdateMyFoodRequest } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { MY_FOODS_QUERY_KEY } from '@/entities/my-food'
import { getApiError } from '@/shared/api'
import { useToast } from '@/shared/ui'

import { deleteMyFood } from '../api/delete-my-food'
import { patchMyFood } from '../api/patch-my-food'
import { restoreMyFood } from '../api/restore-my-food'
import {
	getExistingFoodName,
	getMyFoodErrorKey,
	isDuplicateNameError,
	type MyFoodAction,
} from '../lib/get-my-food-error-key'

export interface MyFoodActions {
	/** `onDuplicate`: the 409 about the name; the form shows it under the field instead of a toast. */
	save: (
		params: { id: string; body: Required<UpdateMyFoodRequest> },
		handlers: { onSuccess: () => void; onDuplicate: (existingName: string | null) => void },
	) => void
	remove: (id: string, onSuccess: () => void) => void
	isSaving: boolean
	isDeleting: boolean
}

interface UseMyFoodActionsParams {
	/** The product is gone (deleted elsewhere): there is nothing left to edit. */
	onGone: () => void
}

/**
 * Save, delete and restore of a saved product. Mounted with the sheet host, not the form, so
 * «Скасувати» in the toast still works after the sheet has closed.
 */
export const useMyFoodActions = ({ onGone }: UseMyFoodActionsParams): MyFoodActions => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()

	const refresh = (): void => {
		void queryClient.invalidateQueries({ queryKey: MY_FOODS_QUERY_KEY })
	}
	const handleError = (error: unknown, action: MyFoodAction): void => {
		const apiError = getApiError(error)
		toast.show(t(getMyFoodErrorKey(apiError, action)))
		refresh()
		if (apiError.kind === 'http' && apiError.errorCode === 'MY_FOOD_NOT_FOUND') onGone()
	}

	const restore = useMutation({
		mutationFn: restoreMyFood,
		onSuccess: refresh,
		onError: (error) => {
			handleError(error, 'restore')
		},
	})
	const update = useMutation({
		mutationFn: patchMyFood,
		onSuccess: refresh,
		onError: (error) => {
			// a taken name is the form's to show, under the field
			if (isDuplicateNameError(getApiError(error))) return
			handleError(error, 'save')
		},
	})
	const removal = useMutation({
		mutationFn: deleteMyFood,
		onSuccess: (_result, id) => {
			refresh()
			toast.show(t('editMyFood.deleted'), {
				action: {
					label: t('editMyFood.restore'),
					onClick: () => {
						restore.mutate(id)
					},
				},
			})
		},
		onError: (error) => {
			handleError(error, 'delete')
		},
	})

	return {
		save: ({ id, body }, { onSuccess, onDuplicate }) => {
			if (update.isPending) return
			update.mutate(
				{ id, ...body },
				{
					onSuccess,
					onError: (error) => {
						const apiError = getApiError(error)
						if (isDuplicateNameError(apiError)) onDuplicate(getExistingFoodName(apiError))
					},
				},
			)
		},
		remove: (id, onSuccess) => {
			if (removal.isPending) return
			removal.mutate(id, { onSuccess })
		},
		isSaving: update.isPending,
		isDeleting: removal.isPending,
	}
}
