import { formatTime } from '@/shared/lib'

import type { ApiMessage } from './api-message'

/** `details.lockedUntil` → «14:35»; the lockout may stop exposing it (roadmap), so it's optional. */
export const getAccountLockedMessage = (details: Record<string, unknown>): ApiMessage => {
	const { lockedUntil } = details
	const date = typeof lockedUntil === 'string' ? new Date(lockedUntil) : null
	if (!date || Number.isNaN(date.getTime())) return { key: 'errors.api.ACCOUNT_LOCKED_NO_TIME' }
	return { key: 'errors.api.ACCOUNT_LOCKED', params: { time: formatTime(date) } }
}
