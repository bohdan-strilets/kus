import { describe, expect, it } from 'vitest'

import { getFieldErrorKey } from './get-field-error-key'

const validation = (fields: unknown) =>
	({
		kind: 'http',
		status: 422,
		errorCode: 'VALIDATION_ERROR',
		details: { fields },
	}) as const

describe('getFieldErrorKey', () => {
	it('maps a known code', () => {
		expect(getFieldErrorKey(validation({ age: 'AGE_BELOW_MINIMUM' }), 'age')).toBe(
			'errors.validation.AGE_BELOW_MINIMUM',
		)
	})

	it('falls back for an unknown code', () => {
		expect(getFieldErrorKey(validation({ age: 'WEIRD' }), 'age')).toBe(
			'errors.validation.INVALID_VALUE',
		)
	})

	it('is null for another field, another error or the network', () => {
		expect(getFieldErrorKey(validation({ heightCm: 'TOO_SMALL' }), 'age')).toBeNull()
		expect(getFieldErrorKey({ kind: 'network' }, 'age')).toBeNull()
	})
})
