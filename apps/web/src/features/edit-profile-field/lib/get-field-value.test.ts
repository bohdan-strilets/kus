import type { ProfileResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { getFieldValue } from './get-field-value'

const makeProfile = (overrides: Partial<ProfileResponse> = {}): ProfileResponse => ({
	email: 'user@example.com',
	name: null,
	addressAs: null,
	profile: {
		sex: 'MALE',
		age: 30,
		heightCm: 182,
		activityLevel: 'VERY_ACTIVE',
		targetWeightKg: 78,
		goalType: 'LOSE',
		paceKgPerWeek: 0.25,
	},
	weight: { kg: 82.4, localDate: '2026-10-07' },
	waist: { cm: 91.5, localDate: '2026-10-07' },
	goals: null,
	...overrides,
})

describe('getFieldValue', () => {
	it('reads the waist from the latest waist measurement', () => {
		expect(getFieldValue(makeProfile(), 'waistCm')).toBe(91.5)
	})

	it('is null when the waist was never measured', () => {
		expect(getFieldValue(makeProfile({ waist: null }), 'waistCm')).toBeNull()
	})

	it('does not mix the weight and the waist', () => {
		expect(getFieldValue(makeProfile(), 'weightKg')).toBe(82.4)
		expect(getFieldValue(makeProfile({ weight: null }), 'weightKg')).toBeNull()
	})

	it('reads VERY_ACTIVE as ACTIVE and plain columns as they are', () => {
		expect(getFieldValue(makeProfile(), 'activityLevel')).toBe('ACTIVE')
		expect(getFieldValue(makeProfile(), 'heightCm')).toBe(182)
	})
})
