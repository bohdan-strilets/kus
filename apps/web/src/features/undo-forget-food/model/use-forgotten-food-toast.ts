import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import {
	type ForgottenFood,
	getMyFoodErrorKey,
	MY_FOODS_QUERY_KEY,
	restoreMyFood,
	useForgottenFoodsStore,
} from '@/entities/my-food'
import { getApiError } from '@/shared/api'
import { useToast } from '@/shared/ui'

const restoreAll = async (foods: readonly ForgottenFood[]): Promise<void> => {
	for (const food of foods) await restoreMyFood(food.id)
}

/**
 * Offers «Скасувати» for foods Kusik removed on the user's word. Mounted once at the app root: a
 * reply can arrive from the outbox on any screen.
 */
export const useForgottenFoodToast = (): void => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()
	const waiting = useForgottenFoodsStore((state) => state.foods)

	const restore = useMutation({
		mutationFn: restoreAll,
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: MY_FOODS_QUERY_KEY })
		},
		onError: (error) => {
			toast.show(t(getMyFoodErrorKey(getApiError(error), 'restore')))
		},
	})
	const { mutate } = restore

	useEffect(() => {
		if (waiting.length === 0) return
		const foods = useForgottenFoodsStore.getState().take()
		if (foods.length === 0) return
		const message =
			foods.length === 1
				? t('chat.forgottenFood', { name: foods[0]?.name })
				: t('chat.forgottenFoods', { names: foods.map((food) => food.name).join(', ') })
		toast.show(message, {
			action: {
				label: t('chat.forgottenFoodUndo'),
				onClick: () => {
					mutate(foods)
				},
			},
		})
	}, [waiting, t, toast, mutate])
}
