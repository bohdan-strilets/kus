import { describe, expect, it } from 'vitest'

import type { AuthUser } from '@kus/shared'

import { toProfileFields, toProfileResponse } from './profile.mapper'

const user: AuthUser = {
	id: '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
	email: 'me@kus.app',
	name: null,
	addressAs: null,
	locale: 'uk',
	timezone: 'Europe/Warsaw',
	createdAt: '2026-10-01T08:00:00.000Z',
	pendingDeletion: false,
	purgeAt: null,
}

const build = (waist: { value: number; localDate: Date } | null) =>
	toProfileResponse({ user, profile: null, weight: null, waist, goals: null, year: 2026 })

describe('toProfileResponse waist', () => {
	it('is null when there is no measurement', () => {
		expect(build(null).waist).toBeNull()
	})

	it('maps the latest waist with its calendar day', () => {
		const response = build({ value: 91.5, localDate: new Date('2026-10-07T00:00:00Z') })

		expect(response.waist).toEqual({ cm: 91.5, localDate: '2026-10-07' })
	})
})

describe('toProfileFields target weight', () => {
	it('rounds half away from zero to one decimal', () => {
		expect(toProfileFields({ targetWeightKg: 70.05 }, 2026).targetWeightKg).toBe(70.1)
		expect(toProfileFields({ targetWeightKg: 78.44 }, 2026).targetWeightKg).toBe(78.4)
	})

	it('keeps null (clears the target) and leaves an absent one out', () => {
		expect(toProfileFields({ targetWeightKg: null }, 2026).targetWeightKg).toBeNull()
		expect(toProfileFields({}, 2026)).not.toHaveProperty('targetWeightKg')
	})
})
