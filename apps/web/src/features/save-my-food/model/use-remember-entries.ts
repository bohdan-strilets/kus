import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { DAY_QUERY_KEY } from '@/entities/day'
import { MESSAGES_QUERY_KEY } from '@/entities/message'
import { MY_FOODS_QUERY_KEY } from '@/entities/my-food'
import { getApiError } from '@/shared/api'
import { playSound, useSettleHold } from '@/shared/lib'
import { useToast } from '@/shared/ui'

import { postRememberEntries } from '../api/remember-entries'
import { getRememberErrorKey } from '../lib/get-remember-error-key'

export interface RememberEntries {
	/**
	 * Resolves once every id is in memory (saved now or already there) and the refetch is done;
	 * false after an error. `onSaved` runs the moment the server has answered, before the refetch.
	 */
	remember: (entryIds: readonly string[], onSaved?: () => void) => Promise<boolean>
	isPending: boolean
	/** The request and the refetch behind it: the feed is held at its end meanwhile. */
	isSettling: boolean
}

/**
 * Saves entries as «Мої продукти». A food that is already there comes back as skipped «exists» and
 * counts as saved. After it the feed and the days are refetched, so `canRemember` drops and the
 * button goes away; `remember` resolves only when that is done.
 */
export const useRememberEntries = (): RememberEntries => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()
	const { isSettling, track } = useSettleHold()
	const mutation = useMutation({
		mutationFn: postRememberEntries,
		onError: (error) => {
			toast.show(t(getRememberErrorKey(getApiError(error))))
			// the entry may be gone: the feed shows the real state
			void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
		},
	})

	const refresh = async (): Promise<void> => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY }),
			queryClient.invalidateQueries({ queryKey: DAY_QUERY_KEY }),
			queryClient.invalidateQueries({ queryKey: MY_FOODS_QUERY_KEY }),
		])
	}
	const run = async (entryIds: readonly string[], onSaved?: () => void): Promise<boolean> => {
		try {
			await mutation.mutateAsync({ entryIds: [...entryIds] })
		} catch {
			// the toast is shown in onError
			return false
		}
		playSound('saved')
		onSaved?.()
		await refresh()
		return true
	}

	const remember = async (entryIds: readonly string[], onSaved?: () => void): Promise<boolean> => {
		if (isSettling) return false
		return track(run(entryIds, onSaved))
	}

	return { remember, isPending: mutation.isPending, isSettling }
}
