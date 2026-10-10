import { updateProfileRequestSchema } from '@kus/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { DAY_QUERY_KEY } from '@/entities/day'
import { PROFILE_QUERY_KEY, type ProfileFieldKey } from '@/entities/profile'
import { getApiError } from '@/shared/api'
import { useToast } from '@/shared/ui'

import { patchProfile } from '../api/patch-profile'
import { getFieldErrorKey } from '../lib/get-field-error-key'

interface UseSaveProfileFieldParams {
	field: ProfileFieldKey
	onSaved: () => void
	/** The translated 422 message about this field; without it the failure is a toast. */
	onFieldError?: (message: string) => void
}

/** Saves one field (PATCH /profile) and refreshes the profile, and the day when the weight changed. */
export const useSaveProfileField = ({
	field,
	onSaved,
	onFieldError,
}: UseSaveProfileFieldParams): { save: (value: unknown) => void; isSaving: boolean } => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()
	const mutation = useMutation({
		mutationFn: patchProfile,
		onSuccess: (profile) => {
			queryClient.setQueryData(PROFILE_QUERY_KEY, profile)
			void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY })
			// the weight shows in the day too
			if (field === 'weightKg') void queryClient.invalidateQueries({ queryKey: DAY_QUERY_KEY })
			onSaved()
		},
		onError: (error) => {
			const fieldKey = getFieldErrorKey(getApiError(error), field)
			if (fieldKey && onFieldError) {
				onFieldError(t(fieldKey))
				return
			}
			toast.show(t('profile.saveError'))
		},
	})

	return {
		save: (value) => {
			mutation.mutate(updateProfileRequestSchema.parse({ [field]: value }))
		},
		isSaving: mutation.isPending,
	}
}
