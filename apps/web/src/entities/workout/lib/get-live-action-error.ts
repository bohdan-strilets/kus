import type { ParseKeys, TFunction } from 'i18next'

import type { ApiError } from '@/shared/api'

const KEY_BY_CODE: Readonly<Record<string, ParseKeys>> = {
	WORKOUT_LIVE_CONFLICT: 'errors.api.WORKOUT_LIVE_CONFLICT',
	WORKOUT_NOT_FOUND: 'errors.api.WORKOUT_NOT_FOUND',
	PROGRAM_TEMPLATE_NOT_FOUND: 'errors.api.PROGRAM_TEMPLATE_NOT_FOUND',
	TOO_MANY_REQUESTS: 'errors.api.TOO_MANY_REQUESTS',
}

/** The toast of a failed start, finish, exit or form save: the server's own code when we have words for it. */
export const getLiveActionError = (error: ApiError, t: TFunction): string => {
	if (error.kind === 'network') return t('errors.api.NETWORK')
	const key = error.kind === 'http' ? KEY_BY_CODE[error.errorCode] : undefined
	return key ? t(key) : t('training.actionError')
}
