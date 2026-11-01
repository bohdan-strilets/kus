import type { ParseKeys, TFunction } from 'i18next'

import type { ApiError } from '@/shared/api'

const KEY_BY_CODE: Readonly<Record<string, ParseKeys>> = {
	PROGRAM_VERSION_CONFLICT: 'errors.api.PROGRAM_VERSION_CONFLICT',
	PROGRAM_PROPOSAL_NOT_FOUND: 'errors.api.PROGRAM_PROPOSAL_NOT_FOUND',
	PROGRAM_PROPOSAL_ALREADY_ACCEPTED: 'errors.api.PROGRAM_PROPOSAL_ALREADY_ACCEPTED',
	PROGRAM_PROPOSAL_REPLACED: 'errors.api.PROGRAM_PROPOSAL_REPLACED',
	PROGRAM_PROPOSAL_INVALID: 'errors.api.PROGRAM_PROPOSAL_INVALID',
}

/** The toast of a failed «Прийняти» / «Перерахувати»: the server's own code when we have words for it. */
export const getProgramActionError = (error: ApiError, t: TFunction): string => {
	if (error.kind === 'network') return t('errors.api.NETWORK')
	const key = error.kind === 'http' ? KEY_BY_CODE[error.errorCode] : undefined
	return key ? t(key) : t('program.card.actionError')
}
