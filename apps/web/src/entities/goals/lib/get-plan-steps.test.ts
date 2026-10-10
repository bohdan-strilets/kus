import type { GoalsPreviewResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import type { PlanProfile } from '../model/plan-step.types'
import { getPlanSteps } from './get-plan-steps'

const t = i18n.t.bind(i18n)

const NBSP = String.fromCharCode(160)
const normalize = (value: string): string => value.replaceAll(NBSP, ' ')

// the numbers of apps/api/test/profile.e2e-spec.ts: MALE 30, 182 cm, 84 kg, LIGHT, LOSE 0.25
const loseProfile: PlanProfile = {
	sex: 'MALE',
	age: 30,
	heightCm: 182,
	weightKg: 84,
	activityLevel: 'LIGHT',
	goalType: 'LOSE',
	paceKgPerWeek: 0.25,
}

const losePreview: GoalsPreviewResponse = {
	kcal: 2200,
	proteinG: 140,
	carbsG: 225,
	fatG: 80,
	appliedPaceKgPerWeek: 0.25,
	etaWeeks: 24,
	warnings: [],
	steps: {
		bmr: 1832.5,
		activityMultiplier: 1.375,
		tdee: 2519.7,
		adjustmentKcal: -275,
		rawKcal: 2244.7,
	},
	current: null,
}

const getRows = (steps: ReturnType<typeof getPlanSteps>) =>
	steps.map(({ title, formula, value }) => ({
		title,
		formula: normalize(formula),
		value: normalize(value),
	}))

describe('getPlanSteps', () => {
	it('spells out the five steps of a weight loss plan', () => {
		const rows = getRows(getPlanSteps({ preview: losePreview, profile: loseProfile, t }))

		expect(rows).toEqual([
			{
				title: 'Базовий обмін',
				formula: '10×84 + 6,25×182 − 5×30 + 5',
				value: '1 833',
			},
			{
				title: 'З урахуванням руху',
				formula: '1 833 × 1,375 («трохи руху»)',
				value: '2 520',
			},
			{
				title: 'Для схуднення',
				formula: '−0,25 кг на тиждень: 2 520 − 275 = 2 245 → округлюю вниз до 50 → 2 200',
				value: '2 200',
			},
			{
				title: 'Білки й жири',
				formula: '1,8 г на кг бажаної ваги, 0,95 г на кг поточної',
				value: '140 · 80 г',
			},
			{ title: 'Вуглеводи', formula: 'решта калорій', value: '225 г' },
		])
	})

	it('shows a fractional weight and the female term', () => {
		const [bmr] = getPlanSteps({
			preview: losePreview,
			profile: { ...loseProfile, sex: 'FEMALE', weightKg: 82.4 },
			t,
		})

		expect(normalize(bmr?.formula ?? '')).toBe('10×82,4 + 6,25×182 − 5×30 − 161')
	})

	it('has no pace for MAINTAIN', () => {
		const preview: GoalsPreviewResponse = {
			...losePreview,
			kcal: 2500,
			appliedPaceKgPerWeek: null,
			steps: { ...losePreview.steps, adjustmentKcal: 0, rawKcal: 2519.7 },
		}
		const steps = getPlanSteps({
			preview,
			profile: { ...loseProfile, goalType: 'MAINTAIN', paceKgPerWeek: null },
			t,
		})

		expect(steps[2]?.title).toBe('Для підтримки')
		expect(normalize(steps[2]?.formula ?? '')).toBe('2 520 → округлюю вниз до 50 → 2 500')
	})

	it('adds the floor to the adjust step when it was applied', () => {
		const preview: GoalsPreviewResponse = {
			...losePreview,
			kcal: 1500,
			warnings: ['KCAL_FLOOR_APPLIED'],
		}
		const [, , adjust] = getPlanSteps({ preview, profile: loseProfile, t })

		expect(normalize(adjust?.formula ?? '')).toMatch(/ → 1 500 → не нижче 1 500$/)
		expect(normalize(adjust?.value ?? '')).toBe('1 500')
	})

	it('writes a gain with a plus', () => {
		const preview: GoalsPreviewResponse = {
			...losePreview,
			kcal: 2750,
			appliedPaceKgPerWeek: 0.25,
			steps: { ...losePreview.steps, adjustmentKcal: 275, rawKcal: 2794.7 },
		}
		const [, , adjust] = getPlanSteps({
			preview,
			profile: { ...loseProfile, goalType: 'GAIN' },
			t,
		})

		expect(adjust?.title).toBe('Для набору')
		expect(normalize(adjust?.formula ?? '')).toBe(
			'+0,25 кг на тиждень: 2 520 + 275 = 2 795 → округлюю вниз до 50 → 2 750',
		)
	})
})
