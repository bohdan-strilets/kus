import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { DAY_QUERY_KEY } from '@/entities/day'
import { MESSAGES_QUERY_KEY } from '@/entities/message'
import { MY_FOODS_QUERY_KEY } from '@/entities/my-food'
import { getApiError } from '@/shared/api'
import { playSound } from '@/shared/lib'
import { useToast } from '@/shared/ui'

import { postRememberEntries } from '../api/remember-entries'
import { getRememberErrorKey } from '../lib/get-remember-error-key'

export interface RememberEntries {
	/** Resolves once every id is in memory (saved now or already there); false after an error. */
	remember: (entryIds: readonly string[]) => Promise<boolean>
	isPending: boolean
}

/**
 * Saves entries as «Мої продукти». A food that is already there comes back as skipped «exists» and
 * counts as saved. After it the feed and the days are refetched, so `canRemember` drops and the
 * button goes away.
 */
export const useRememberEntries = (): RememberEntries => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()
	const mutation = useMutation({
		mutationFn: postRememberEntries,
		onSuccess: () => {
			playSound('saved')
			void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
			void queryClient.invalidateQueries({ queryKey: DAY_QUERY_KEY })
			void queryClient.invalidateQueries({ queryKey: MY_FOODS_QUERY_KEY })
		},
		onError: (error) => {
			toast.show(t(getRememberErrorKey(getApiError(error))))
			// the entry may be gone: the feed shows the real state
			void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
		},
	})

	const remember = async (entryIds: readonly string[]): Promise<boolean> => {
		if (mutation.isPending) return false
		try {
			await mutation.mutateAsync({ entryIds: [...entryIds] })
			return true
		} catch {
			// the toast is shown in onError
			return false
		}
	}

	return { remember, isPending: mutation.isPending }
}
