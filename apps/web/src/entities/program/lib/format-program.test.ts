import type { TemplateExerciseTarget } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import {
	formatProgramTarget,
	formatProgramTemplateMeta,
	formatProgramVersionDate,
	getProgramTemplateMeta,
} from './format-program'

const t = i18n.t.bind(i18n)

const target = (patch: Partial<TemplateExerciseTarget> = {}): TemplateExerciseTarget => ({
	sets: null,
	repsMin: null,
	repsMax: null,
	weightKg: null,
	progressStepKg: null,
	restSec: null,
	durationMin: null,
	distanceM: null,
	...patch,
})

const strength = { kind: 'STRENGTH' } as const

describe('template meta', () => {
	const exercise = (kind: 'STRENGTH' | 'CARDIO') => ({ kind })

	it('counts only strength exercises', () => {
		const meta = getProgramTemplateMeta({
			exercises: [exercise('STRENGTH'), exercise('STRENGTH'), exercise('CARDIO')] as never,
			hasCardio: true,
			estimatedMin: 55,
		})
		expect(meta).toEqual({ strengthCount: 2, hasCardio: true, estimatedMin: 55 })
	})

	it('reads «5 вправ + кардіо · ≈ 55 хв»', () => {
		const exercises = [
			...Array.from({ length: 5 }, () => exercise('STRENGTH')),
			exercise('CARDIO'),
		] as never
		expect(formatProgramTemplateMeta({ exercises, hasCardio: true, estimatedMin: 55 }, t)).toBe(
			'5 вправ + кардіо · ~55 хв',
		)
	})

	it('without cardio, without an estimate, cardio alone', () => {
		const four = Array.from({ length: 4 }, () => exercise('STRENGTH')) as never
		expect(
			formatProgramTemplateMeta({ exercises: four, hasCardio: false, estimatedMin: 0 }, t),
		).toBe('4 вправи')
		expect(
			formatProgramTemplateMeta(
				{ exercises: [exercise('CARDIO')] as never, hasCardio: true, estimatedMin: 20 },
				t,
			),
		).toBe('кардіо · ~20 хв')
	})
})

describe('version date', () => {
	it('is dd.MM', () => {
		expect(formatProgramVersionDate('2026-10-31T12:00:00.000Z', t)).toBe('Версія від 31.10')
	})
})

describe('plan target', () => {
	it('sets, a rep range and a load', () => {
		const exercise = {
			...strength,
			target: target({ sets: 3, repsMin: 8, repsMax: 12, weightKg: 60 }),
		}
		expect(formatProgramTarget(exercise, t)).toBe('3 підходи · 8–12 повт. · 60 кг')
	})

	it('bodyweight and no weight', () => {
		const sets = { sets: 3, repsMin: 15, repsMax: 20 }
		expect(formatProgramTarget({ ...strength, target: target({ ...sets, weightKg: 0 }) }, t)).toBe(
			'3 підходи · 15–20 повт. · власна вага',
		)
		expect(
			formatProgramTarget(
				{ ...strength, target: target({ sets: 4, repsMin: 12, repsMax: 15 }) },
				t,
			),
		).toBe('4 підходи · 12–15 повт.')
	})

	it('a fraction and one rep value', () => {
		const exercise = {
			...strength,
			target: target({ sets: 3, repsMin: 10, repsMax: 10, weightKg: 77.5 }),
		}
		expect(formatProgramTarget(exercise, t)).toBe('3 підходи · 10 повт. · 77,5 кг')
	})

	it('step and rest only when asked', () => {
		const exercise = {
			...strength,
			target: target({
				sets: 3,
				repsMin: 8,
				repsMax: 12,
				weightKg: 70,
				progressStepKg: 2.5,
				restSec: 120,
			}),
		}
		expect(formatProgramTarget(exercise, t)).toBe('3 підходи · 8–12 повт. · 70 кг')
		expect(formatProgramTarget(exercise, t, { withDetails: true })).toBe(
			'3 підходи · 8–12 повт. · 70 кг · +2,5 кг · 120 с',
		)
	})

	it('nothing set is null', () => {
		expect(formatProgramTarget({ ...strength, target: target() }, t)).toBeNull()
	})

	it('cardio is minutes, with a distance when set', () => {
		const cardio = (patch: Partial<TemplateExerciseTarget>) => ({
			kind: 'CARDIO' as const,
			target: target(patch),
		})
		expect(formatProgramTarget(cardio({ durationMin: 10 }), t)).toBe('10 хв')
		expect(formatProgramTarget(cardio({ durationMin: 20, distanceM: 3000 }), t)).toBe(
			'20 хв · 3,0 км',
		)
	})
})

describe('plan notation invariant', () => {
	it('has no «×» in any plan line', () => {
		const lines = [
			formatProgramTarget({ ...strength, target: target({ sets: 3, repsMin: 8, repsMax: 12 }) }, t),
			formatProgramTarget(
				{ ...strength, target: target({ sets: 3, repsMin: 8, repsMax: 12, weightKg: 60 }) },
				t,
			),
			formatProgramTarget(
				{
					...strength,
					target: target({
						sets: 4,
						repsMin: 5,
						repsMax: 5,
						weightKg: 0,
						progressStepKg: 2.5,
						restSec: 90,
					}),
				},
				t,
				{ withDetails: true },
			),
			formatProgramTarget(
				{ kind: 'CARDIO', target: target({ durationMin: 20, distanceM: 3000 }) },
				t,
			),
		]
		lines.forEach((line) => {
			expect(line).not.toBeNull()
			expect(line).not.toContain('×')
		})
		expect(lines[0]).toBe('3 підходи · 8–12 повт.')
	})
})
