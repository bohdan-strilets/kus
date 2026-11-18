import { describe, expect, it } from 'vitest'

import { getRecipeErrorKey } from './get-recipe-error-key'

describe('getRecipeErrorKey', () => {
	it('maps recipe error codes to their messages', () => {
		expect(
			getRecipeErrorKey({ kind: 'http', status: 409, errorCode: 'RECIPE_NAME_TAKEN', details: {} }),
		).toBe('errors.api.RECIPE_NAME_TAKEN')
		expect(
			getRecipeErrorKey({ kind: 'http', status: 404, errorCode: 'RECIPE_NOT_FOUND', details: {} }),
		).toBe('errors.api.RECIPE_NOT_FOUND')
	})

	it('falls back to network and unknown', () => {
		expect(getRecipeErrorKey({ kind: 'network' })).toBe('errors.api.NETWORK')
		expect(getRecipeErrorKey({ kind: 'unknown' })).toBe('errors.api.UNKNOWN')
		expect(getRecipeErrorKey({ kind: 'http', status: 500, errorCode: 'X', details: {} })).toBe(
			'errors.api.UNKNOWN',
		)
	})
})
