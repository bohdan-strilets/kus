import { describe, expect, it } from 'vitest'

import type { AuthUser } from '@kus/shared'

import { roundWaist, roundWeight, toProfileResponse } from './profile.mapper'

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

describe('roundWaist', () => {
	it('keeps one decimal', () => {
		expect(roundWaist(82.46)).toBe(82.5)
		expect(roundWaist(82.44)).toBe(82.4)
		expect(roundWaist(82)).toBe(82)
	})

	it('rounds like the weight does', () => {
		expect(roundWaist(81.25)).toBe(roundWeight(81.25))
	})

	it('keeps the limits intact', () => {
		expect(roundWaist(40)).toBe(40)
		expect(roundWaist(200)).toBe(200)
	})
})

describe('toProfileResponse waist', () => {
	it('is null when there is no measurement', () => {
		expect(build(null).waist).toBeNull()
	})

	it('maps the latest waist with its calendar day', () => {
		const response = build({ value: 91.5, localDate: new Date('2026-10-07T00:00:00Z') })

		expect(response.waist).toEqual({ cm: 91.5, localDate: '2026-10-07' })
	})
})
