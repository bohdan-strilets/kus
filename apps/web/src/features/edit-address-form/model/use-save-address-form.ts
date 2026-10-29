import type { AddressForm } from '@kus/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { updateSessionUser } from '@/entities/session'
import { useToast } from '@/shared/ui'

import { patchMe } from '../api/patch-me'

/** Saves «Як до тебе звертатися» (PATCH /users/me); the session follows at once, then onSaved. */
export const useSaveAddressForm = ({
	onSaved,
}: {
	onSaved: () => void
}): { save: (addressForm: AddressForm) => void; isSaving: boolean } => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()
	const mutation = useMutation({
		mutationFn: patchMe,
		onSuccess: (user) => {
			updateSessionUser(queryClient, user)
			onSaved()
		},
		onError: () => {
			toast.show(t('profile.saveError'))
		},
	})

	return {
		save: (addressForm) => {
			mutation.mutate({ addressForm })
		},
		isSaving: mutation.isPending,
	}
}
