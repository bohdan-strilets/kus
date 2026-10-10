import { type ApiMessage, getAccountLockedMessage, getApiError } from '@/shared/api'

import type { ChangePasswordError } from '../model/change-password.types'

const HTTP_TOO_MANY_REQUESTS = 429
const HTTP_SERVER_ERROR_MIN = 500
const VALIDATION_FIELDS = ['currentPassword', 'newPassword'] as const
const VALIDATION_CODES: Readonly<Record<string, ApiMessage>> = {
	REQUIRED: { key: 'errors.validation.REQUIRED' },
	INVALID_FORMAT: { key: 'errors.validation.INVALID_FORMAT' },
	TOO_SMALL: { key: 'errors.validation.TOO_SMALL' },
	TOO_LARGE: { key: 'errors.validation.TOO_LARGE' },
}
const INVALID_VALUE: ApiMessage = { key: 'errors.validation.INVALID_VALUE' }

const formError = (key: ApiMessage['key']): ChangePasswordError => ({ fields: {}, form: { key } })

/** 422 `details.fields` → a message under each password field the server complained about. */
const getValidationError = (details: Record<string, unknown>): ChangePasswordError => {
	const { fields } = details
	if (typeof fields !== 'object' || fields === null) return formError('errors.api.UNKNOWN')

	const result: ChangePasswordError = { fields: {} }
	for (const field of VALIDATION_FIELDS) {
		if (!(field in fields)) continue
		const code: unknown = Object.entries(fields).find(([name]) => name === field)?.[1]
		result.fields[field] =
			(typeof code === 'string' ? VALIDATION_CODES[code] : undefined) ?? INVALID_VALUE
	}
	if (Object.keys(result.fields).length === 0) return formError('errors.api.UNKNOWN')
	return result
}

/** Where a failed password change shows its message: under the field it is about, or the alert line. */
export const getChangePasswordError = (error: unknown): ChangePasswordError => {
	const apiError = getApiError(error)
	if (apiError.kind === 'network') return formError('errors.api.NETWORK')
	if (apiError.kind === 'unknown') return formError('errors.api.UNKNOWN')

	const { status, errorCode, details } = apiError
	switch (errorCode) {
		case 'PASSWORD_INCORRECT':
			return { fields: { currentPassword: { key: 'errors.api.PASSWORD_INCORRECT' } } }
		case 'PASSWORD_SAME':
			return { fields: { newPassword: { key: 'errors.api.PASSWORD_SAME' } } }
		case 'ACCOUNT_LOCKED':
			return { fields: { currentPassword: getAccountLockedMessage(details) } }
		case 'VALIDATION_ERROR':
			return getValidationError(details)
	}
	if (status === HTTP_TOO_MANY_REQUESTS) return formError('errors.api.TOO_MANY_REQUESTS')
	if (status >= HTTP_SERVER_ERROR_MIN) return formError('errors.api.SERVER')
	return formError('errors.api.UNKNOWN')
}
