import type { ApiError } from '@/shared/api'

export type RecipeErrorKey =
	| 'errors.api.RECIPE_NOT_FOUND'
	| 'errors.api.RECIPE_NAME_TAKEN'
	| 'errors.api.RECIPE_PORTION_INVALID'
	| 'errors.api.NETWORK'
	| 'errors.api.UNKNOWN'

const RECIPE_ERROR_KEYS: Readonly<Record<string, RecipeErrorKey>> = {
	RECIPE_NOT_FOUND: 'errors.api.RECIPE_NOT_FOUND',
	RECIPE_NAME_TAKEN: 'errors.api.RECIPE_NAME_TAKEN',
	RECIPE_PORTION_INVALID: 'errors.api.RECIPE_PORTION_INVALID',
}

/** The toast after a recipe action (log a portion, delete, restore) that didn't go through. */
export const getRecipeErrorKey = (error: ApiError): RecipeErrorKey => {
	if (error.kind === 'network') return 'errors.api.NETWORK'
	if (error.kind !== 'http') return 'errors.api.UNKNOWN'
	return RECIPE_ERROR_KEYS[error.errorCode] ?? 'errors.api.UNKNOWN'
}
