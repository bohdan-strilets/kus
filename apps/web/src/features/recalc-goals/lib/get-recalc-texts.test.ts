import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import {
	getPaceIcon,
	getRecalcBubbleText,
	getRecalcPaceText,
	getWasText,
	toPlanProfile,
} from './get-recalc-texts'

const t = i18n.t.bind(i18n)
const normalizeSpaces = (text: string): string => text.replace(/\s/g, ' ')

describe('getRecalcBubbleText', () => {
	it('puts weight, activity and the loss pace into the sentence', () => {
		const text = getRecalcBubbleText(
			{ weightKg: 82.4, activityLevel: 'LIGHT', goalType: 'LOSE', pace: 0.25 },
			t,
		)
		expect(text).toContain('82,4 кг')
		expect(text).toContain('мінус 0,25 кг на тиждень')
	})

	it('shows a whole weight without a decimal and maintain without a pace', () => {
		const text = getRecalcBubbleText(
			{ weightKg: 84, activityLevel: 'LIGHT', goalType: 'MAINTAIN', pace: null },
			t,
		)
		expect(text).toContain('84 кг')
		expect(text).toContain('тримати вагу')
	})
})

describe('getRecalcPaceText', () => {
	const base = {
		goalType: 'LOSE' as const,
		pace: 0.25,
		weightKg: 82.4,
		targetWeightKg: 78,
		etaWeeks: 17.6,
	}

	it('adds the target and the time for a loss', () => {
		expect(getRecalcPaceText(base, t)).toBe(
			'Темп −0,25 кг на тиждень. До 78 кг — приблизно за 4 місяці.',
		)
	})

	it('drops the target part without a target', () => {
		expect(getRecalcPaceText({ ...base, targetWeightKg: null, etaWeeks: null }, t)).toBe(
			'Темп −0,25 кг на тиждень.',
		)
	})

	it('says plus for a gain without a target', () => {
		expect(
			getRecalcPaceText({ ...base, goalType: 'GAIN', targetWeightKg: null, etaWeeks: null }, t),
		).toBe('Плюс 0,25 кг на тиждень.')
	})

	it('holds the weight for maintain', () => {
		expect(getRecalcPaceText({ ...base, goalType: 'MAINTAIN', pace: null }, t)).toContain(
			'Тримаємо 82,4 кг',
		)
	})
})

describe('getPaceIcon', () => {
	it('is flat for maintain and the down trend otherwise', () => {
		expect(getPaceIcon('MAINTAIN')).toBe('trend-flat')
		expect(getPaceIcon('GAIN')).toBe('trend-down')
	})
})

describe('getWasText', () => {
	it('lists the previous goals', () => {
		const current = {
			kcal: 2200,
			proteinG: 140,
			carbsG: 225,
			fatG: 80,
			source: 'MANUAL' as const,
			validFrom: '2026-01-01',
			updatedAt: '2026-01-01T00:00:00.000Z',
		}
		expect(normalizeSpaces(getWasText(current, t))).toBe('Було: 2 200 ккал · Б 140 · В 225 · Ж 80')
	})
})

describe('toPlanProfile', () => {
	const response = {
		email: 'a@b.co',
		name: null,
		addressAs: null,
		profile: {
			sex: 'MALE' as const,
			age: 30,
			heightCm: 182,
			activityLevel: 'LIGHT' as const,
			targetWeightKg: 78,
			goalType: 'LOSE' as const,
			paceKgPerWeek: 0.25,
		},
		weight: { kg: 82.4, localDate: '2026-01-01' },
		goals: null,
	}

	it('narrows a full profile', () => {
		expect(toPlanProfile(response)?.weightKg).toBe(82.4)
	})

	it('is null while a field is missing', () => {
		expect(toPlanProfile({ ...response, weight: null })).toBeNull()
		expect(toPlanProfile({ ...response, profile: { ...response.profile, sex: null } })).toBeNull()
	})
})
