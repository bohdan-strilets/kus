import { describe, expect, it } from 'vitest'

import type { ApiError } from '@/shared/api'

import {
	getExistingFoodName,
	getMyFoodErrorKey,
	isDuplicateNameError,
} from './get-my-food-error-key'

const http = (errorCode: string, details: Record<string, unknown> = {}): ApiError => ({
	kind: 'http',
	status: 409,
	errorCode,
	details,
})

describe('getMyFoodErrorKey', () => {
	it('names a missing or a duplicate product', () => {
		expect(getMyFoodErrorKey(http('MY_FOOD_NOT_FOUND'), 'delete')).toBe(
			'errors.api.MY_FOOD_NOT_FOUND',
		)
		expect(getMyFoodErrorKey(http('MY_FOOD_EXISTS'), 'restore')).toBe('errors.api.MY_FOOD_EXISTS')
	})

	it('falls back to the action text, and to the network text without a connection', () => {
		expect(getMyFoodErrorKey(http('SOMETHING'), 'save')).toBe('editMyFood.saveError')
		expect(getMyFoodErrorKey({ kind: 'unknown' }, 'delete')).toBe('editMyFood.deleteError')
		expect(getMyFoodErrorKey({ kind: 'network' }, 'restore')).toBe('errors.api.NETWORK')
	})
})

describe('duplicate name', () => {
	it('recognises MY_FOOD_EXISTS and reads the name of the existing product', () => {
		const error = http('MY_FOOD_EXISTS', { existingId: 'x', name: 'Кабаноси Tarczyński' })

		expect(isDuplicateNameError(error)).toBe(true)
		expect(getExistingFoodName(error)).toBe('Кабаноси Tarczyński')
	})

	it('has no name when the details lack it', () => {
		expect(getExistingFoodName(http('MY_FOOD_EXISTS'))).toBeNull()
		expect(isDuplicateNameError(http('MY_FOOD_NOT_FOUND'))).toBe(false)
		expect(getExistingFoodName({ kind: 'network' })).toBeNull()
	})
})
