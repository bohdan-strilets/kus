import { type ApiMessage, getAccountLockedMessage, getApiError } from '@/shared/api'

import type { AuthFormError, AuthFormField, ValidationMessageKey } from '../model/auth-error.types'

const AUTH_FORM_FIELDS: readonly AuthFormField[] = ['name', 'email', 'password', 'consent']
const VALIDATION_CODES: Readonly<Record<string, ValidationMessageKey>> = {
	REQUIRED: 'errors.validation.REQUIRED',
	INVALID_FORMAT: 'errors.validation.INVALID_FORMAT',
	TOO_SMALL: 'errors.validation.TOO_SMALL',
	TOO_LARGE: 'errors.validation.TOO_LARGE',
}
const HTTP_TOO_MANY_REQUESTS = 429
const HTTP_SERVER_ERROR_MIN = 500

const formError = (message: ApiMessage): AuthFormError => ({ fields: {}, form: message })

const isAuthFormField = (field: string): field is AuthFormField =>
	AUTH_FORM_FIELDS.some((known) => known === field)

/** 422 `details.fields` → a message under each known field (server rules may be stricter). */
const getValidationError = (details: Record<string, unknown>): AuthFormError => {
	const { fields } = details
	if (typeof fields !== 'object' || fields === null) return formError({ key: 'errors.api.UNKNOWN' })

	const result: AuthFormError = { fields: {} }
	for (const [field, code] of Object.entries(fields)) {
		if (!isAuthFormField(field)) continue
		const key = typeof code === 'string' ? VALIDATION_CODES[code] : undefined
		result.fields[field] = { key: key ?? 'errors.validation.INVALID_VALUE' }
	}
	if (Object.keys(result.fields).length === 0) return formError({ key: 'errors.api.UNKNOWN' })
	return result
}

/**
 * Where a failed login / registration shows its message: under a field (wrong credentials,
 * a taken email, server validation) or in the alert line above the button (everything that is
 * not about one field). Stays until the next attempt — so not a toast.
 */
export const getAuthError = (error: unknown): AuthFormError => {
	const apiError = getApiError(error)
	if (apiError.kind === 'network') return formError({ key: 'errors.api.NETWORK' })
	if (apiError.kind === 'unknown') return formError({ key: 'errors.api.UNKNOWN' })

	const { status, errorCode, details } = apiError
	switch (errorCode) {
		case 'INVALID_CREDENTIALS':
			return { fields: { password: { key: 'errors.api.INVALID_CREDENTIALS' } } }
		case 'EMAIL_TAKEN':
			return { fields: { email: { key: 'errors.api.EMAIL_TAKEN' } } }
		case 'VALIDATION_ERROR':
			return getValidationError(details)
		case 'ACCOUNT_LOCKED':
			return formError(getAccountLockedMessage(details))
		case 'REGISTRATION_DISABLED':
			return formError({ key: 'errors.api.REGISTRATION_DISABLED' })
	}
	if (status === HTTP_TOO_MANY_REQUESTS) return formError({ key: 'errors.api.TOO_MANY_REQUESTS' })
	if (status >= HTTP_SERVER_ERROR_MIN) return formError({ key: 'errors.api.SERVER' })
	return formError({ key: 'errors.api.UNKNOWN' })
}
