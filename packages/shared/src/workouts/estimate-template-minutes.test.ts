import { describe, expect, it } from 'vitest'

import type { TemplateExerciseDraft } from '../schemas/programs.js'
import { estimateTemplateMinutes } from './estimate-template-minutes.js'

type Target = TemplateExerciseDraft['target']

const emptyTarget: Target = {
	sets: null,
	repsMin: null,
	repsMax: null,
	weightKg: null,
	progressStepKg: null,
	restSec: null,
	durationMin: null,
	distanceM: null,
}

const strength = (overrides: Partial<Target> = {}): TemplateExerciseDraft => ({
	name: 'Жим',
	exerciseId: null,
	kind: 'STRENGTH',
	muscleGroup: null,
	target: {
		...emptyTarget,
		sets: 4,
		repsMin: 8,
		repsMax: 10,
		weightKg: 60,
		restSec: 90,
		...overrides,
	},
})

const cardio = (overrides: Partial<Target> = {}): TemplateExerciseDraft => ({
	name: 'Біг',
	exerciseId: null,
	kind: 'CARDIO',
	muscleGroup: null,
	target: { ...emptyTarget, ...overrides },
})

const repeat = (count: number, make: () => TemplateExerciseDraft): TemplateExerciseDraft[] =>
	Array.from({ length: count }, make)

describe('estimateTemplateMinutes', () => {
	it('is at least 5 for an empty template', () => {
		expect(estimateTemplateMinutes([])).toBe(5)
	})

	it('is at least 5 for a tiny workout', () => {
		// 3 x (45 + 90) - 90 + 60 = 375 s ~ 6 min -> 5
		expect(estimateTemplateMinutes([strength({ sets: 3 })])).toBe(5)
	})

	it('counts strength sets with rest between them and a changeover', () => {
		// each: 4 x 135 - 90 + 60 = 510 s = 8.5 min; four of them = 34 min -> 35
		expect(estimateTemplateMinutes(repeat(4, () => strength()))).toBe(35)
	})

	it('uses the default 90 s rest when restSec is null', () => {
		const withRest = (restSec: number | null) => repeat(4, () => strength({ restSec }))
		expect(estimateTemplateMinutes(withRest(null))).toBe(estimateTemplateMinutes(withRest(90)))
		expect(estimateTemplateMinutes(withRest(null))).toBe(35)
	})

	it('scales with rest time', () => {
		const withRest = (restSec: number) => repeat(6, () => strength({ restSec }))
		// rest 30: 4 x 75 - 30 + 60 = 330 s, x6 = 33 min -> 35
		expect(estimateTemplateMinutes(withRest(30))).toBe(35)
		// rest 180: 4 x 225 - 180 + 60 = 780 s, x6 = 78 min -> 80
		expect(estimateTemplateMinutes(withRest(180))).toBe(80)
	})

	it('treats bodyweight (weightKg null) like weighted strength', () => {
		const weighted = repeat(4, () => strength({ weightKg: 60 }))
		const bodyweight = repeat(4, () => strength({ weightKg: null }))
		expect(estimateTemplateMinutes(bodyweight)).toBe(estimateTemplateMinutes(weighted))
	})

	it('counts only the changeover for strength without sets', () => {
		// 12 x 60 s = 12 min -> 10
		expect(estimateTemplateMinutes(repeat(12, () => strength({ sets: null })))).toBe(10)
	})

	it('counts cardio by minutes', () => {
		expect(estimateTemplateMinutes([cardio({ durationMin: 30 })])).toBe(30)
	})

	it('counts cardio by distance only at 6 min/km', () => {
		// 5 km = 30 min
		expect(estimateTemplateMinutes([cardio({ distanceM: 5000 })])).toBe(30)
	})

	it('prefers duration over distance for cardio', () => {
		expect(estimateTemplateMinutes([cardio({ durationMin: 20, distanceM: 10_000 })])).toBe(20)
	})

	it('counts cardio without duration or distance as zero', () => {
		expect(estimateTemplateMinutes([cardio()])).toBe(5)
	})

	it('rounds to the nearest 5 minutes', () => {
		expect(estimateTemplateMinutes([cardio({ durationMin: 32 })])).toBe(30)
		expect(estimateTemplateMinutes([cardio({ durationMin: 33 })])).toBe(35)
	})

	it('sums strength and cardio', () => {
		// 34 min strength + 21 min cardio = 55
		const exercises = [...repeat(4, () => strength()), cardio({ durationMin: 21 })]
		expect(estimateTemplateMinutes(exercises)).toBe(55)
	})
})
