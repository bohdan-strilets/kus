import type { ApiError } from '@/shared/api'

export type EditErrorKey =
	| 'errors.api.ENTRY_NOT_FOUND'
	| 'errors.api.ENTRY_CHANGED'
	| 'errors.api.NETWORK'
	| 'editEntry.saveError'
	| 'editEntry.deleteError'

const KNOWN_CODES: Partial<Record<string, EditErrorKey>> = {
	ENTRY_NOT_FOUND: 'errors.api.ENTRY_NOT_FOUND',
	ENTRY_CHANGED: 'errors.api.ENTRY_CHANGED',
}

/** The toast after a save or a delete that didn't go through. */
export const getEditErrorKey = (error: ApiError, action: 'save' | 'delete'): EditErrorKey => {
	if (error.kind === 'network') return 'errors.api.NETWORK'
	const known = error.kind === 'http' ? KNOWN_CODES[error.errorCode] : undefined
	if (known) return known
	return action === 'save' ? 'editEntry.saveError' : 'editEntry.deleteError'
}
