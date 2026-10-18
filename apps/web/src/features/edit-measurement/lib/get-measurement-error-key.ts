import type { ApiError } from '@/shared/api'

export type MeasurementActionErrorKey =
	| 'errors.api.MEASUREMENT_NOT_FOUND'
	| 'errors.api.NETWORK'
	| 'editMeasurement.saveError'
	| 'editMeasurement.deleteError'
	| 'editMeasurement.restoreError'

export type MeasurementAction = 'save' | 'delete' | 'restore'

const ACTION_ERROR_KEY = {
	save: 'editMeasurement.saveError',
	delete: 'editMeasurement.deleteError',
	restore: 'editMeasurement.restoreError',
} as const

/** The toast after a save, a delete or a restore that didn't go through. */
export const getMeasurementErrorKey = (
	error: ApiError,
	action: MeasurementAction,
): MeasurementActionErrorKey => {
	if (error.kind === 'network') return 'errors.api.NETWORK'
	if (error.kind === 'http' && error.errorCode === 'MEASUREMENT_NOT_FOUND') {
		return 'errors.api.MEASUREMENT_NOT_FOUND'
	}
	return ACTION_ERROR_KEY[action]
}

export type MeasurementBoundCode = 'TOO_SMALL' | 'TOO_LARGE'

/** A 422 about `value`: which bound the backend says was crossed; null — the error is not about it. */
export const getMeasurementBoundCode = (error: ApiError): MeasurementBoundCode | null => {
	if (error.kind !== 'http' || error.errorCode !== 'VALIDATION_ERROR') return null
	const { fields } = error.details
	if (typeof fields !== 'object' || fields === null) return null
	const code: unknown = (fields as Record<string, unknown>).value
	return code === 'TOO_SMALL' || code === 'TOO_LARGE' ? code : null
}
