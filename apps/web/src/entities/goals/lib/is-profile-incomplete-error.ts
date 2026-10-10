import { getApiError } from '@/shared/api'

const CONFLICT_STATUS = 409
const PROFILE_INCOMPLETE_CODE = 'PROFILE_INCOMPLETE'

/** The profile lacks something the calculation needs: a state to explain, not a failure to retry. */
export const isProfileIncompleteError = (error: unknown): boolean => {
	const apiError = getApiError(error)
	return (
		apiError.kind === 'http' &&
		apiError.status === CONFLICT_STATUS &&
		apiError.errorCode === PROFILE_INCOMPLETE_CODE
	)
}
