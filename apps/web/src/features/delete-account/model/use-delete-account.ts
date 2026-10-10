import { useMutation } from '@tanstack/react-query'
import { type BaseSyntheticEvent } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { useLeaveSession } from '@/entities/session'
import { translateApiMessage } from '@/shared/api'

import { postDeleteAccount } from '../api/post-delete-account'
import { getDeleteAccountError } from '../lib/get-delete-account-error'

interface DeleteAccountFormValues {
	password: string
}

export interface DeleteAccount {
	form: UseFormReturn<DeleteAccountFormValues>
	onSubmit: (event?: BaseSyntheticEvent) => Promise<void>
	isDeleting: boolean
}

/** Success ends the session on this device (the API already cleared the cookies) → /login. */
export const useDeleteAccount = (): DeleteAccount => {
	const { t } = useTranslation()
	const { leave } = useLeaveSession()
	const form = useForm<DeleteAccountFormValues>({ defaultValues: { password: '' } })
	const mutation = useMutation({ mutationFn: postDeleteAccount })

	const onSubmit = form.handleSubmit(async ({ password }) => {
		try {
			await mutation.mutateAsync({ password })
		} catch (error) {
			form.setError('password', {
				type: 'server',
				message: translateApiMessage(t, getDeleteAccountError(error)),
			})
			return
		}
		leave()
	})

	return { form, onSubmit, isDeleting: form.formState.isSubmitting }
}
