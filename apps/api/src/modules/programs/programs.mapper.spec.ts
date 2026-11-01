import type { ProgramDraft, TemplateExerciseDraft, TemplateExerciseTarget } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { normalizeDraft, toTemplateWrite, withTargetDefaults } from './programs.mapper'

const KEY = '0199b3a4-0000-7000-8000-0000000000a1'

const target = (partial: Partial<TemplateExerciseTarget> = {}): TemplateExerciseTarget => ({
	sets: 3,
	repsMin: 8,
	repsMax: 12,
	weightKg: 60,
	progressStepKg: null,
	restSec: null,
	durationMin: null,
	distanceM: null,
	...partial,
})

const exercise = (partial: Partial<TemplateExerciseDraft> = {}): TemplateExerciseDraft => ({
	name: 'Жим лежачи',
	exerciseId: null,
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	target: target(),
	...partial,
})

describe('withTargetDefaults', () => {
	it('gives a weighted strength exercise the default step and rest', () => {
		expect(withTargetDefaults(exercise()).target).toMatchObject({
			progressStepKg: 2.5,
			restSec: 90,
		})
	})

	it('keeps the step and rest the user chose', () => {
		const result = withTargetDefaults(
			exercise({ target: target({ progressStepKg: 5, restSec: 120 }) }),
		)

		expect(result.target).toMatchObject({ progressStepKg: 5, restSec: 120 })
	})

	it('gives a bodyweight exercise no step, but a rest', () => {
		const result = withTargetDefaults(
			exercise({ target: target({ weightKg: null, progressStepKg: 2.5 }) }),
		)

		expect(result.target).toMatchObject({ progressStepKg: null, restSec: 90 })
	})

	it('leaves cardio without step and rest', () => {
		const result = withTargetDefaults(
			exercise({
				kind: 'CARDIO',
				muscleGroup: null,
				target: target({ weightKg: null, progressStepKg: 2.5, restSec: 60, durationMin: 20 }),
			}),
		)

		expect(result.target).toMatchObject({ progressStepKg: null, restSec: null, durationMin: 20 })
	})
})

describe('normalizeDraft', () => {
	const draft: ProgramDraft = {
		title: null,
		mode: 'ROTATE',
		perWeek: null,
		templates: [
			{ key: KEY, name: 'А', weekdays: [5, 1], exercises: [exercise()], estimatedMin: 0 },
			{ key: KEY, name: 'Б', weekdays: [], exercises: [], estimatedMin: 99 },
		],
		pinnedKey: null,
	}

	it('sorts weekdays, counts the estimate and fills defaults', () => {
		const [first] = normalizeDraft(draft).templates

		expect(first?.weekdays).toEqual([1, 5])
		expect(first?.estimatedMin).toBeGreaterThan(0)
		expect(first?.exercises[0]?.target.restSec).toBe(90)
	})

	it('gives a repeated template key a new one', () => {
		const [first, second] = normalizeDraft(draft).templates

		expect(first?.key).toBe(KEY)
		expect(second?.key).not.toBe(KEY)
	})
})

describe('toTemplateWrite', () => {
	it('takes the group from the dictionary row when the draft has none, and none for cardio', () => {
		const write = toTemplateWrite(
			{
				key: KEY,
				name: 'А',
				weekdays: [],
				estimatedMin: 0,
				exercises: [
					exercise({ muscleGroup: null }),
					exercise({ name: 'Біг', kind: 'CARDIO', muscleGroup: 'LEGS' }),
				],
			},
			2,
			[
				{ id: 'e1', name: 'Жим лежачи', kind: 'STRENGTH', muscleGroup: 'CHEST' },
				{ id: 'e2', name: 'Біг', kind: 'CARDIO', muscleGroup: null },
			],
		)

		expect(write.position).toBe(2)
		expect(write.exercises.map((row) => [row.exerciseId, row.muscleGroup, row.position])).toEqual([
			['e1', 'CHEST', 0],
			['e2', null, 1],
		])
	})
})
