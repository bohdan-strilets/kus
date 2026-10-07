import type { TFunction } from 'i18next'

import type { AuthErrorMessage } from '../model/auth-error.types'

export const translateAuthError = (t: TFunction, message: AuthErrorMessage): string =>
	message.key === 'errors.api.ACCOUNT_LOCKED' ? t(message.key, message.params) : t(message.key)
