import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { getRecipeErrorKey, RECIPES_QUERY_KEY, restoreRecipe } from '@/entities/recipe'
import { getApiError } from '@/shared/api'
import { useToast } from '@/shared/ui'

import { deleteRecipe } from '../api/delete-recipe'

export interface DeleteRecipe {
	remove: (id: string) => void
	isPending: boolean
}

interface UseDeleteRecipeParams {
	/** The recipe is deleted: the screen leaves its page. */
	onDeleted: () => void
}

/**
 * Deletes a recipe and offers «Скасувати». The undo is a plain call, not a mutation of this hook:
 * the screen unmounts right after the delete, and the toast must still work.
 */
export const useDeleteRecipe = ({ onDeleted }: UseDeleteRecipeParams): DeleteRecipe => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()

	const refresh = (): void => {
		void queryClient.invalidateQueries({ queryKey: RECIPES_QUERY_KEY })
	}
	const restore = async (id: string): Promise<void> => {
		try {
			await restoreRecipe(id)
		} catch (error) {
			toast.show(t(getRecipeErrorKey(getApiError(error))))
		}
		refresh()
	}

	const mutation = useMutation({
		mutationFn: deleteRecipe,
		onSuccess: (_result, id) => {
			refresh()
			toast.show(t('recipes.detail.deleted'), {
				keepUntilExpired: true,
				action: {
					label: t('recipes.detail.undo'),
					onClick: () => {
						void restore(id)
					},
				},
			})
			onDeleted()
		},
		onError: (error) => {
			toast.show(t(getRecipeErrorKey(getApiError(error))))
			refresh()
		},
	})

	return {
		remove: (id) => {
			if (mutation.isPending) return
			mutation.mutate(id)
		},
		isPending: mutation.isPending,
	}
}
