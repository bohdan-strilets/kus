import { zodResolver } from '@hookform/resolvers/zod'
import type { LoginRequest } from '@kus/shared'
import { useMemo } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { login } from '../api/auth-requests'
import { AUTH_FORM_MODE } from './auth-form.constants'
import { createLoginSchema, type LoginFormValues } from './auth-form.schemas'
import { type AuthSubmit, useAuthSubmit } from './use-auth-submit'

export interface LoginFormState extends AuthSubmit {
	form: UseFormReturn<LoginFormValues>
	/** Any message on screen — the page shows the worried hamster (auth-login-error). */
	hasError: boolean
}

const LOGIN_FIELDS = ['email', 'password'] as const

const toLoginRequest = (values: LoginFormValues): LoginRequest => values

export const useLoginForm = (): LoginFormState => {
	const { t } = useTranslation()
	const schema = useMemo(() => createLoginSchema(t), [t])
	const form = useForm<LoginFormValues>({
		resolver: zodResolver(schema),
		defaultValues: { email: '', password: '' },
		...AUTH_FORM_MODE,
	})
	const submit = useAuthSubmit({
		form,
		request: login,
		toRequest: toLoginRequest,
		fields: LOGIN_FIELDS,
	})
	const hasError = Object.keys(form.formState.errors).length > 0 || submit.formMessage !== null

	return { ...submit, form, hasError }
}
