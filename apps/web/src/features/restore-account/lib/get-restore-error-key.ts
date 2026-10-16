import type { ApiError } from '@/shared/api'

export type RestoreErrorKey = 'errors.api.ACCOUNT_RESTORE_EXPIRED' | 'accountRestore.error'

/** The toast after a restore that didn't go through; a retry only helps when the grace period is still on. */
export const getRestoreErrorKey = (error: ApiError): RestoreErrorKey => {
	if (error.kind === 'http' && error.errorCode === 'ACCOUNT_RESTORE_EXPIRED') {
		return 'errors.api.ACCOUNT_RESTORE_EXPIRED'
	}
	return 'accountRestore.error'
}
