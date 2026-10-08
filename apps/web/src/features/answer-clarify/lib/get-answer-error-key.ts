import type { ApiError } from '@/shared/api'

export type AnswerErrorKey =
	| 'errors.api.CLARIFICATION_NOT_FOUND'
	| 'errors.api.CLARIFICATION_ALREADY_ANSWERED'
	| 'errors.api.CLARIFICATION_NOT_APPLICABLE'
	| 'errors.api.NETWORK'
	| 'errors.api.UNKNOWN'

const KNOWN_CODES: Partial<Record<string, AnswerErrorKey>> = {
	CLARIFICATION_NOT_FOUND: 'errors.api.CLARIFICATION_NOT_FOUND',
	CLARIFICATION_ALREADY_ANSWERED: 'errors.api.CLARIFICATION_ALREADY_ANSWERED',
	CLARIFICATION_NOT_APPLICABLE: 'errors.api.CLARIFICATION_NOT_APPLICABLE',
}

/** The toast after a tap that didn't apply. */
export const getAnswerErrorKey = (error: ApiError): AnswerErrorKey => {
	if (error.kind === 'network') return 'errors.api.NETWORK'
	if (error.kind === 'http') return KNOWN_CODES[error.errorCode] ?? 'errors.api.UNKNOWN'
	return 'errors.api.UNKNOWN'
}
