import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { FACTS_QUERY_KEY } from '@/entities/fact'
import { getApiError } from '@/shared/api'
import { useToast } from '@/shared/ui'

import { deleteFact, patchFact, restoreFact } from '../api/fact-requests'
import {
	type FactAction,
	getFactErrorMessage,
	getFactFieldCode,
	isFactGoneError,
} from '../lib/get-fact-error'
import type { FactFieldCode } from './edit-fact.schema'

export interface FactActions {
	/** `onFieldError`: a 409 or a 422 about the text; the form shows it under the field instead of a toast. */
	save: (
		params: { id: string; text: string },
		handlers: { onSuccess: () => void; onFieldError: (code: FactFieldCode) => void },
	) => void
	remove: (id: string, onSuccess: () => void) => void
	isSaving: boolean
	isDeleting: boolean
}

interface UseFactActionsParams {
	/** The fact is gone (deleted elsewhere): there is nothing left to edit. */
	onGone: () => void
}

/**
 * Save, delete and restore of a fact. Mounted with the sheet host, not the form, so «Скасувати»
 * in the toast still works after the sheet has closed.
 */
export const useFactActions = ({ onGone }: UseFactActionsParams): FactActions => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()

	const refresh = (): void => {
		void queryClient.invalidateQueries({ queryKey: FACTS_QUERY_KEY })
	}
	const handleError = (error: unknown, action: FactAction): void => {
		const apiError = getApiError(error)
		toast.show(getFactErrorMessage(apiError, action, t))
		refresh()
		if (isFactGoneError(apiError)) onGone()
	}

	const restore = useMutation({
		mutationFn: restoreFact,
		onSuccess: refresh,
		onError: (error) => {
			handleError(error, 'restore')
		},
	})
	const update = useMutation({
		mutationFn: patchFact,
		onSuccess: refresh,
		onError: (error) => {
			// the text is the form's to show, under the field
			if (getFactFieldCode(getApiError(error)) !== null) return
			handleError(error, 'save')
		},
	})
	const removal = useMutation({
		mutationFn: deleteFact,
		onSuccess: (_result, id) => {
			refresh()
			toast.show(t('editFact.deleted'), {
				action: {
					label: t('editFact.restore'),
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
		save: (params, { onSuccess, onFieldError }) => {
			if (update.isPending) return
			update.mutate(params, {
				onSuccess,
				onError: (error) => {
					const code = getFactFieldCode(getApiError(error))
					if (code !== null) onFieldError(code)
				},
			})
		},
		remove: (id, onSuccess) => {
			if (removal.isPending) return
			removal.mutate(id, { onSuccess })
		},
		isSaving: update.isPending,
		isDeleting: removal.isPending,
	}
}
