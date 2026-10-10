import type { ProfileResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { getProfileRows } from './get-profile-rows'

const t = i18n.t.bind(i18n)

const makeProfile = (overrides: Partial<ProfileResponse['profile']> = {}): ProfileResponse => ({
	email: 'user@example.com',
	name: 'Богдан',
	addressAs: null,
	profile: {
		sex: 'MALE',
		age: 30,
		heightCm: 182,
		activityLevel: 'LIGHT',
		targetWeightKg: 78,
		goalType: 'LOSE',
		paceKgPerWeek: 0.25,
		...overrides,
	},
	weight: { kg: 82.4, localDate: '2026-10-07' },
	goals: null,
})

const NBSP = String.fromCharCode(160)
const normalize = (value: string | null): string | null => value?.replaceAll(NBSP, ' ') ?? null

describe('getProfileRows', () => {
	it('lists the body rows in order with formatted values', () => {
		const { body } = getProfileRows(makeProfile(), t)

		expect(body.map((row) => row.key)).toEqual([
			'sex',
			'age',
			'heightCm',
			'weightKg',
			'activityLevel',
		])
		expect(body.map((row) => normalize(row.value))).toEqual([
			'Чоловік',
			'30 років',
			'182 см',
			'82,4 кг',
			'Трохи руху',
		])
	})

	it('includes the pace for LOSE and GAIN', () => {
		const lose = getProfileRows(makeProfile(), t).goal
		const gain = getProfileRows(makeProfile({ goalType: 'GAIN', paceKgPerWeek: 0.5 }), t).goal

		expect(lose.map((row) => row.key)).toEqual(['goalType', 'targetWeightKg', 'paceKgPerWeek'])
		expect(lose[2]?.value).toBe('−0,25 кг на тиждень')
		expect(gain[2]?.value).toBe('+0,5 кг на тиждень')
	})

	it('has no pace row for MAINTAIN', () => {
		const { goal } = getProfileRows(makeProfile({ goalType: 'MAINTAIN', paceKgPerWeek: null }), t)

		expect(goal.map((row) => row.key)).toEqual(['goalType', 'targetWeightKg'])
	})

	it('gives null for what is not set', () => {
		const empty = makeProfile({
			sex: null,
			age: null,
			heightCm: null,
			activityLevel: null,
			targetWeightKg: null,
			goalType: null,
			paceKgPerWeek: null,
		})
		const { body, goal } = getProfileRows({ ...empty, weight: null }, t)

		expect([...body, ...goal].every((row) => row.value === null)).toBe(true)
	})
})
