import { describe, expect, it } from 'vitest'

import { updateMeRequestSchema } from './users.js'

describe('updateMeRequestSchema', () => {
	it('accepts either field alone', () => {
		expect(updateMeRequestSchema.parse({ addressForm: 'FEMININE' })).toEqual({
			addressForm: 'FEMININE',
		})
		expect(updateMeRequestSchema.parse({ addressAs: '  Бо ' })).toEqual({ addressAs: 'Бо' })
	})

	it('clears addressAs with an empty string and keeps the other field untouched', () => {
		const parsed = updateMeRequestSchema.parse({ addressAs: '' })
		expect(parsed.addressAs).toBeNull()
		expect(parsed.addressForm).toBeUndefined()
	})

	it('rejects an empty body and an unknown form', () => {
		expect(updateMeRequestSchema.safeParse({}).success).toBe(false)
		expect(updateMeRequestSchema.safeParse({ addressForm: 'ROBOT' }).success).toBe(false)
	})
})
