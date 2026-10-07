import { zodResolver } from '@hookform/resolvers/zod'
import type { RegisterRequest } from '@kus/shared'
import { useMemo } from 'react'
import { useForm, type UseFormReturn, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { register } from '../api/auth-requests'
import { AUTH_FORM_MODE } from './auth-form.constants'
import { createRegisterSchema, type RegisterFormValues } from './auth-form.schemas'
import { type AuthSubmit, useAuthSubmit } from './use-auth-submit'

export interface RegisterFormState extends AuthSubmit {
	form: UseFormReturn<RegisterFormValues>
	/** Without consent the submit button is disabled (design/docs/components.md, Consent card). */
	hasConsent: boolean
}

const REGISTER_FIELDS = ['name', 'email', 'password', 'consent'] as const

const toRegisterRequest = ({ name, email, password }: RegisterFormValues): RegisterRequest => ({
	name,
	email,
	password,
	// reachable only with the box ticked: the button is disabled and the schema refuses false
	consent: true,
})

export const useRegisterForm = (): RegisterFormState => {
	const { t } = useTranslation()
	const schema = useMemo(() => createRegisterSchema(t), [t])
	const form = useForm<RegisterFormValues>({
		resolver: zodResolver(schema),
		defaultValues: { name: '', email: '', password: '', consent: false },
		...AUTH_FORM_MODE,
	})
	const submit = useAuthSubmit({
		form,
		request: register,
		toRequest: toRegisterRequest,
		fields: REGISTER_FIELDS,
	})
	const hasConsent = useWatch({ control: form.control, name: 'consent' })

	return { ...submit, form, hasConsent }
}
