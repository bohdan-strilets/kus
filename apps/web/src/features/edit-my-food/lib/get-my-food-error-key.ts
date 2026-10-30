import type { ApiError } from '@/shared/api'

export type MyFoodActionErrorKey =
	| 'errors.api.MY_FOOD_NOT_FOUND'
	| 'errors.api.MY_FOOD_EXISTS'
	| 'errors.api.NETWORK'
	| 'editMyFood.saveError'
	| 'editMyFood.deleteError'
	| 'editMyFood.restoreError'

export type MyFoodAction = 'save' | 'delete' | 'restore'

const ACTION_ERROR_KEY = {
	save: 'editMyFood.saveError',
	delete: 'editMyFood.deleteError',
	restore: 'editMyFood.restoreError',
} as const

/** The toast after a save, a delete or a restore that didn't go through. */
export const getMyFoodErrorKey = (error: ApiError, action: MyFoodAction): MyFoodActionErrorKey => {
	if (error.kind === 'network') return 'errors.api.NETWORK'
	if (error.kind !== 'http') return ACTION_ERROR_KEY[action]
	if (error.errorCode === 'MY_FOOD_NOT_FOUND') return 'errors.api.MY_FOOD_NOT_FOUND'
	if (error.errorCode === 'MY_FOOD_EXISTS') return 'errors.api.MY_FOOD_EXISTS'
	return ACTION_ERROR_KEY[action]
}

/** MY_FOOD_EXISTS (409) of a save: the form shows it under the name instead of a toast. */
export const isDuplicateNameError = (error: ApiError): boolean =>
	error.kind === 'http' && error.errorCode === 'MY_FOOD_EXISTS'

/** The name of the product that already has this name, from the 409 details; null when absent. */
export const getExistingFoodName = (error: ApiError): string | null => {
	if (error.kind !== 'http') return null
	const { name } = error.details
	return typeof name === 'string' && name !== '' ? name : null
}
