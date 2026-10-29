import type { ApiError } from '@/shared/api'

export type DeleteWorkoutErrorKey =
	'errors.api.WORKOUT_NOT_FOUND' | 'errors.api.NETWORK' | 'workout.deleteError'

/** The toast after a delete that didn't go through. */
export const getDeleteWorkoutErrorKey = (error: ApiError): DeleteWorkoutErrorKey => {
	if (error.kind === 'network') return 'errors.api.NETWORK'
	if (error.kind === 'http' && error.errorCode === 'WORKOUT_NOT_FOUND')
		return 'errors.api.WORKOUT_NOT_FOUND'
	return 'workout.deleteError'
}
