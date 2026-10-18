import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { DAY_QUERY_KEY } from '@/entities/day'
import { MESSAGES_QUERY_KEY } from '@/entities/message'
import { PROFILE_QUERY_KEY } from '@/entities/profile'
import { getApiError } from '@/shared/api'
import { useToast } from '@/shared/ui'

import { deleteMeasurement } from '../api/delete-measurement'
import { patchMeasurement } from '../api/patch-measurement'
import { restoreMeasurement } from '../api/restore-measurement'
import {
	getMeasurementBoundCode,
	getMeasurementErrorKey,
	type MeasurementAction,
	type MeasurementBoundCode,
} from '../lib/get-measurement-error-key'

export interface MeasurementActions {
	/** `onBound`: the 422 about the value; the form shows it under the field instead of a toast. */
	save: (
		params: { id: string; value: number },
		handlers: { onSuccess: () => void; onBound: (code: MeasurementBoundCode) => void },
	) => void
	remove: (id: string, onSuccess: () => void) => void
	isSaving: boolean
	isDeleting: boolean
}

interface UseMeasurementActionsParams {
	/** The measurement is gone (deleted elsewhere): there is nothing left to edit. */
	onGone: () => void
}

/**
 * The three actions on a measurement. Mounted with the sheet host, not the form, so «Повернути»
 * in the toast still works after the sheet has closed. Every outcome refreshes the chat cards,
 * the progress (under the day key) and the profile (its current weight and waist).
 */
export const useMeasurementActions = ({
	onGone,
}: UseMeasurementActionsParams): MeasurementActions => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()

	const refresh = (): void => {
		void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
		void queryClient.invalidateQueries({ queryKey: DAY_QUERY_KEY })
		void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY })
	}
	const handleError = (error: unknown, action: MeasurementAction): void => {
		const apiError = getApiError(error)
		toast.show(t(getMeasurementErrorKey(apiError, action)))
		refresh()
		if (apiError.kind === 'http' && apiError.errorCode === 'MEASUREMENT_NOT_FOUND') onGone()
	}

	const restore = useMutation({
		mutationFn: restoreMeasurement,
		onSuccess: refresh,
		onError: (error) => {
			handleError(error, 'restore')
		},
	})
	const update = useMutation({
		mutationFn: patchMeasurement,
		onSuccess: refresh,
		onError: (error) => {
			// a value out of range is the form's to show, under the field
			if (getMeasurementBoundCode(getApiError(error)) !== null) return
			handleError(error, 'save')
		},
	})
	const removal = useMutation({
		mutationFn: deleteMeasurement,
		onSuccess: (_result, id) => {
			refresh()
			toast.show(t('editMeasurement.deleted'), {
				action: {
					label: t('editMeasurement.restore'),
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
		save: (params, { onSuccess, onBound }) => {
			update.mutate(params, {
				onSuccess,
				onError: (error) => {
					const code = getMeasurementBoundCode(getApiError(error))
					if (code) onBound(code)
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
