import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type BaseSyntheticEvent, useMemo } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { updateSessionUser } from '@/entities/session'
import { useToast } from '@/shared/ui'

import { patchMe } from '../api/patch-me'
import { type AddressFormValues, createAddressSchema } from './address-form.schema'

export interface AddressForm {
	form: UseFormReturn<AddressFormValues>
	onSubmit: (event?: BaseSyntheticEvent) => Promise<void>
	isSaving: boolean
}

/** Saves «Як до тебе звертатися?»; the greeting in the chat follows the session at once. */
export const useAddressForm = (addressAs: string | null): AddressForm => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()
	const schema = useMemo(() => createAddressSchema(t), [t])
	const form = useForm<AddressFormValues>({
		resolver: zodResolver(schema),
		defaultValues: { addressAs: addressAs ?? '' },
		mode: 'onChange',
	})
	const mutation = useMutation({
		mutationFn: patchMe,
		onSuccess: (user) => {
			updateSessionUser(queryClient, user)
			form.reset({ addressAs: user.addressAs ?? '' })
			toast.show(t('profile.address.saved'))
		},
		onError: () => {
			toast.show(t('profile.address.saveError'))
		},
	})

	return {
		form,
		// a failed save shows a toast (onError); the field keeps what was typed
		onSubmit: form.handleSubmit((values) => {
			mutation.mutate({ addressAs: values.addressAs })
		}),
		isSaving: mutation.isPending,
	}
}
