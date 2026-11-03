import { type LiveConflictReason, liveConflictReasonSchema } from '@kus/shared'

import { getApiError, HTTP_STATUS } from '@/shared/api'

export const LIVE_CONFLICT_CODE = 'WORKOUT_LIVE_CONFLICT'

/**
 * 409 of a live session: the chat replaced it (EDITED, read it again) or closed it (FINISHED, stop
 * writing). The original axios error stays as `cause`.
 */
export class LiveWorkoutConflictError extends Error {
	readonly reason: LiveConflictReason

	constructor(reason: LiveConflictReason, cause: unknown) {
		super(LIVE_CONFLICT_CODE, { cause })
		this.name = 'LiveWorkoutConflictError'
		this.reason = reason
	}
}

/** Turns the 409 into the typed error; every other failure goes on as it was. */
export const toLiveConflictError = (error: unknown): unknown => {
	const apiError = getApiError(error)
	if (
		apiError.kind !== 'http' ||
		apiError.status !== HTTP_STATUS.conflict ||
		apiError.errorCode !== LIVE_CONFLICT_CODE
	) {
		return error
	}
	const reason = liveConflictReasonSchema.safeParse(apiError.details.reason)
	return reason.success ? new LiveWorkoutConflictError(reason.data, error) : error
}
