import type { ApiError } from '@/shared/api'

export type RememberErrorKey =
	| 'errors.api.ENTRY_NOT_FOUND'
	| 'errors.api.MY_FOOD_NOT_FOUND'
	| 'errors.api.MY_FOOD_EXISTS'
	| 'errors.api.NETWORK'
	| 'errors.api.UNKNOWN'

const KNOWN_CODES: Partial<Record<string, RememberErrorKey>> = {
	ENTRY_NOT_FOUND: 'errors.api.ENTRY_NOT_FOUND',
	MY_FOOD_NOT_FOUND: 'errors.api.MY_FOOD_NOT_FOUND',
	MY_FOOD_EXISTS: 'errors.api.MY_FOOD_EXISTS',
}

/** The toast after a «Запам'ятати» that didn't go through. */
export const getRememberErrorKey = (error: ApiError): RememberErrorKey => {
	if (error.kind === 'network') return 'errors.api.NETWORK'
	if (error.kind === 'http') return KNOWN_CODES[error.errorCode] ?? 'errors.api.UNKNOWN'
	return 'errors.api.UNKNOWN'
}
