import type { AuthUser } from '@kus/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type BaseSyntheticEvent, useState } from 'react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { setSessionUser } from '@/entities/session'
import { type ApiMessage, translateApiMessage } from '@/shared/api'

import { getAuthError } from '../lib/get-auth-error'
import type { AuthFormField } from './auth-error.types'

interface UseAuthSubmitOptions<TValues extends FieldValues, TRequest> {
	form: UseFormReturn<TValues>
	request: (body: TRequest) => Promise<AuthUser>
	toRequest: (values: TValues) => TRequest
	fields: readonly (AuthFormField & Path<TValues>)[]
}

export interface AuthSubmit {
	onSubmit: (event?: BaseSyntheticEvent) => Promise<void>
	isSubmitting: boolean
	/** The alert line above the button; null when the last error belongs to a field. */
	formMessage: ApiMessage | null
}

/**
 * Login and registration share the flow: validate, call the API, put the user into the session
 * cache (the guest guard then leaves the page), or route the error to a field / the alert line.
 */
export const useAuthSubmit = <TValues extends FieldValues, TRequest>({
	form,
	request,
	toRequest,
	fields,
}: UseAuthSubmitOptions<TValues, TRequest>): AuthSubmit => {
	const { t } = useTranslation()
	const queryClient = useQueryClient()
	const [formMessage, setFormMessage] = useState<ApiMessage | null>(null)
	const mutation = useMutation({
		mutationFn: request,
		onSuccess: (user) => {
			setSessionUser(queryClient, user)
		},
	})

	const showServerError = (error: unknown): void => {
		const authError = getAuthError(error)
		for (const field of fields) {
			const message = authError.fields[field]
			if (message)
				form.setError(field, { type: 'server', message: translateApiMessage(t, message) })
		}
		setFormMessage(authError.form ?? null)
	}

	const onSubmit = form.handleSubmit(
		async (values) => {
			// the previous message stays visible until this new attempt
			setFormMessage(null)
			try {
				await mutation.mutateAsync(toRequest(values))
			} catch (error) {
				showServerError(error)
			}
		},
		() => {
			setFormMessage(null)
		},
	)

	// formState.isSubmitting turns on at the click, before the async validation: a double tap can't
	// send two logins (two lockout attempts, two sessions) or a register + a false «email taken»
	return { onSubmit, isSubmitting: form.formState.isSubmitting || mutation.isPending, formMessage }
}
