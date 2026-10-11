import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { type BaseSyntheticEvent, useMemo, useState } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { type ApiMessage, translateApiMessage } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { useStackBack } from '@/shared/lib'
import { useToast } from '@/shared/ui'

import { postChangePassword } from '../api/post-change-password'
import { getChangePasswordError } from '../lib/get-change-password-error'
import { type ChangePasswordFormValues, createChangePasswordSchema } from './change-password.schema'
import type { ChangePasswordField } from './change-password.types'

export interface ChangePasswordFormState {
	form: UseFormReturn<ChangePasswordFormValues>
	onSubmit: (event?: BaseSyntheticEvent) => Promise<void>
	isSubmitting: boolean
	/** The alert line above the button; null when the last error belongs to a field. */
	formMessage: ApiMessage | null
}

const FIELDS: readonly ChangePasswordField[] = ['currentPassword', 'newPassword', 'repeatPassword']

export const useChangePasswordForm = (): ChangePasswordFormState => {
	const { t } = useTranslation()
	const toast = useToast()
	const goBack = useStackBack(ROUTES.settings)
	const schema = useMemo(() => createChangePasswordSchema(t), [t])
	const [formMessage, setFormMessage] = useState<ApiMessage | null>(null)
	const form = useForm<ChangePasswordFormValues>({
		resolver: zodResolver(schema),
		defaultValues: { currentPassword: '', newPassword: '', repeatPassword: '' },
		mode: 'onChange',
	})
	const mutation = useMutation({ mutationFn: postChangePassword })

	const showServerError = (error: unknown): void => {
		const passwordError = getChangePasswordError(error)
		for (const field of FIELDS) {
			const message = passwordError.fields[field]
			if (message) {
				form.setError(field, { type: 'server', message: translateApiMessage(t, message) })
			}
		}
		setFormMessage(passwordError.form ?? null)
	}

	const onSubmit = form.handleSubmit(
		async (values) => {
			setFormMessage(null)
			try {
				await mutation.mutateAsync({
					currentPassword: values.currentPassword,
					newPassword: values.newPassword,
				})
			} catch (error) {
				showServerError(error)
				return
			}
			toast.show(t('changePassword.success'))
			form.reset()
			// the form's entry goes: Back from the settings must not reopen it
			goBack()
		},
		() => {
			setFormMessage(null)
		},
	)

	return { form, onSubmit, isSubmitting: form.formState.isSubmitting, formMessage }
}
