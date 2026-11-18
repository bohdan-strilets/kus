import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { DAY_QUERY_KEY } from '@/entities/day'
import { getRecipeErrorKey, RECIPES_QUERY_KEY } from '@/entities/recipe'
import { getApiError } from '@/shared/api'
import { playSound } from '@/shared/lib'
import { useToast } from '@/shared/ui'

import { logRecipePortion, type LogRecipePortionParams } from '../api/log-recipe-portion'

export interface LogRecipePortion {
	log: (params: LogRecipePortionParams) => void
	isPending: boolean
}

/** Adds a portion of the recipe to today; the figures come from the server, nothing is multiplied here. */
export const useLogRecipePortion = (): LogRecipePortion => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()

	const mutation = useMutation({
		mutationFn: logRecipePortion,
		onSuccess: () => {
			playSound('saved')
			toast.show(t('recipes.detail.added'))
			void queryClient.invalidateQueries({ queryKey: DAY_QUERY_KEY })
			void queryClient.invalidateQueries({ queryKey: RECIPES_QUERY_KEY })
		},
		onError: (error) => {
			toast.show(t(getRecipeErrorKey(getApiError(error))))
		},
	})

	return {
		log: (params) => {
			if (mutation.isPending) return
			mutation.mutate(params)
		},
		isPending: mutation.isPending,
	}
}
