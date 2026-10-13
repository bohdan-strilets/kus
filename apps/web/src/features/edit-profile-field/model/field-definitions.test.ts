import { PROFILE_LIMITS } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { FIELD_DEFINITIONS } from './field-definitions'

describe('FIELD_DEFINITIONS', () => {
	it('describes the waist as a decimal number inside the shared limits', () => {
		expect(FIELD_DEFINITIONS.waistCm).toMatchObject({
			kind: 'number',
			inputMode: 'decimal',
			isInteger: false,
			limits: PROFILE_LIMITS.waistCm,
		})
	})

	it('gives weight and waist a hint that resolves to real text', () => {
		for (const field of ['weightKg', 'waistCm'] as const) {
			const definition = FIELD_DEFINITIONS[field]
			if (definition.kind !== 'number' || !definition.hintKey) throw new Error('no hint')

			expect(i18n.exists(definition.hintKey)).toBe(true)
		}
	})

	it('has no hint on the fields that need none', () => {
		const definition = FIELD_DEFINITIONS.heightCm

		expect(definition.kind === 'number' && definition.hintKey).toBeFalsy()
	})
})
