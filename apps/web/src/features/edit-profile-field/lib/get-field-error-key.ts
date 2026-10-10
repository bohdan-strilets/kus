import type { ParseKeys } from 'i18next'

import type { ApiError } from '@/shared/api'

const KNOWN_CODES = new Set([
	'REQUIRED',
	'INVALID_FORMAT',
	'TOO_SMALL',
	'TOO_LARGE',
	'INVALID_VALUE',
	'AGE_BELOW_MINIMUM',
])

/** The message under the field for a 422 about it; null — the error is not about the field. */
export const getFieldErrorKey = (error: ApiError, field: string): ParseKeys | null => {
	if (error.kind !== 'http' || error.errorCode !== 'VALIDATION_ERROR') return null
	const { fields } = error.details
	if (typeof fields !== 'object' || fields === null) return null
	const code: unknown = (fields as Record<string, unknown>)[field]
	if (typeof code !== 'string') return null
	return KNOWN_CODES.has(code)
		? (`errors.validation.${code}` as ParseKeys)
		: 'errors.validation.INVALID_VALUE'
}
