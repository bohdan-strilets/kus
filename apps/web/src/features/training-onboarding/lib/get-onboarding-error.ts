import type { ParseKeys, TFunction } from 'i18next'

import type { ApiError } from '@/shared/api'

const KEY_BY_CODE: Readonly<Record<string, ParseKeys>> = {
	TRAINING_ONBOARDING_NOT_FOUND: 'errors.api.TRAINING_ONBOARDING_NOT_FOUND',
	TRAINING_ONBOARDING_CLOSED: 'errors.api.TRAINING_ONBOARDING_CLOSED',
}

/** The toast of a failed «Так» / «Пізніше»: the server's own code when we have words for it. */
export const getOnboardingActionError = (error: ApiError, t: TFunction): string => {
	if (error.kind === 'network') return t('errors.api.NETWORK')
	const key = error.kind === 'http' ? KEY_BY_CODE[error.errorCode] : undefined
	return key ? t(key) : t('trainingOnboarding.actionError')
}
