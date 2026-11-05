import { workoutFormSchema } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeTemplate, makeTemplateExercise, TEMPLATE_ID } from '@/shared/testing'

import {
	buildFormDraft,
	getChangedSetNumbers,
	getExerciseState,
	getPlanCountChange,
	restorePlan,
} from './build-form-draft'
import { buildFormPayload } from './build-form-payload'
import { addFormSet, patchFormSet, removeFormSet, restoreFormSet } from './form-exercise-edit'
import { formatChangeLine } from './format-change-line'
import { formatExerciseSummary } from './format-plan-summary'
import type { FormExerciseValue } from './workout-form.types'

const NOW = { localDate: '2026-11-02', time: '18:30' }
const t = i18n.t.bind(i18n)

/** 3 sets of 66 kg × 12. */
const identical = (): FormExerciseValue => {
	const target = makeTemplateExercise().target
	const exercise = makeTemplateExercise({
		target: { ...target, repsMin: 12, repsMax: 12, weightKg: 66 },
	})
	const draft = buildFormDraft(makeTemplate({ exercises: [exercise] }), { now: NOW })
	return draft.exercises[0] as FormExerciseValue
}

/** 3 sets whose reps are 10, 11, 12 in both the plan and the form. */
const different = (): FormExerciseValue => {
	const base = identical()
	const reps = (index: number): number => 10 + index
	return {
		...base,
		sets: base.sets.map((set, index) => ({ ...set, reps: reps(index) })),
		plan: base.plan && {
			...base.plan,
			sets: base.plan.sets.map((set, index) => ({ ...set, reps: reps(index) })),
		},
	}
}

describe('the number of sets against the plan', () => {
	it('deleting the 1st of 3 identical sets: nothing changed, 2 of 3, the subtitle says what is there', () => {
		const exercise = removeFormSet(identical(), 0)

		expect(getChangedSetNumbers(exercise)).toEqual([])
		expect(getPlanCountChange(exercise)).toEqual({ actual: 2, planned: 3 })
		expect(getExerciseState(exercise)).toBe('CHANGED')
		expect(formatExerciseSummary(exercise, t)).toBe('2 підходи · 66 кг × 12')
		expect(formatChangeLine(exercise, t)).toBe('Змінено: 2 підходи замість 3')
	})

	it('deleting the 1st of 3 different sets: the remaining rows are not highlighted', () => {
		const exercise = removeFormSet(different(), 0)

		expect(getChangedSetNumbers(exercise)).toEqual([])
		expect(formatChangeLine(exercise, t)).toBe('Змінено: 2 підходи замість 3')
	})

	it('adding a set: 4 of 3 and no ordinals', () => {
		const exercise = addFormSet(identical())

		expect(getChangedSetNumbers(exercise)).toEqual([])
		expect(getPlanCountChange(exercise)).toEqual({ actual: 4, planned: 3 })
		expect(formatChangeLine(exercise, t)).toBe('Змінено: 4 підходи замість 3')
	})

	it('a deleted and an added set do not cancel out', () => {
		const exercise = addFormSet(removeFormSet(identical(), 0))

		expect(getPlanCountChange(exercise)).toBeNull()
		expect(getExerciseState(exercise)).toBe('CHANGED')
	})

	it('delete and «Скасувати» is PLANNED again', () => {
		const exercise = identical()
		const removed = exercise.sets[1]
		if (!removed) throw new Error('no set')

		const restored = restoreFormSet(removeFormSet(exercise, 1), 1, removed)

		expect(getExerciseState(restored)).toBe('PLANNED')
		expect(formatChangeLine(restored, t)).toBeNull()
	})

	it('«Як за планом» is PLANNED', () => {
		const messy = patchFormSet(removeFormSet(different(), 0), 0, { reps: 1 })

		expect(getExerciseState(restorePlan(messy))).toBe('PLANNED')
	})

	it('a changed value is found by the plan set it came from, not by position', () => {
		const exercise = patchFormSet(removeFormSet(different(), 0), 1, { reps: 5 })

		expect(getChangedSetNumbers(exercise)).toEqual([2])
		expect(formatChangeLine(exercise, t)).toBe(
			'Змінено: 2 підходи замість 3, 2-й підхід · план: 3 підходи · 66 кг × 10',
		)
	})

	it('only values changed: the old «Змінено … · план …» line', () => {
		const exercise = patchFormSet(different(), 1, { reps: 5 })

		expect(formatChangeLine(exercise, t)).toBe('Змінено: 2-й підхід · план: 3 підходи · 66 кг × 10')
	})

	it('no sets at all: «без підходів»', () => {
		const exercise = { ...identical(), sets: [] }

		expect(formatExerciseSummary(exercise, t)).toBe('без підходів')
		expect(formatChangeLine(exercise, t)).toBe(
			'Змінено: без підходів · план: 3 підходи · 66 кг × 12',
		)
	})

	it('a warm-up is not counted', () => {
		const exercise = identical()
		const warmup = { ...exercise.sets[0], isWarmup: true } as FormExerciseValue['sets'][number]

		expect(getPlanCountChange({ ...exercise, sets: [warmup, ...exercise.sets.slice(1)] })).toEqual({
			actual: 2,
			planned: 3,
		})
	})
})

describe('planKey stays on the device', () => {
	it('the plan copy and restorePlan point at the plan sets; added sets point at nothing', () => {
		const exercise = identical()
		const planKeys = (exercise.plan?.sets ?? []).map(({ rowKey }) => rowKey)

		expect(exercise.sets.map(({ planKey }) => planKey)).toEqual(planKeys)
		expect(restorePlan(addFormSet(exercise)).sets.map(({ planKey }) => planKey)).toEqual(planKeys)
		expect(addFormSet(exercise).sets.at(-1)?.planKey).toBeNull()
	})

	it('is not in the payload', () => {
		const payload = buildFormPayload({
			values: {
				localDate: '2026-11-02',
				startTime: '18:30',
				durationMin: 55,
				exercises: [identical()],
			},
			clientRequestId: '0199b3a4-0000-7000-8000-0000000000d0',
			templateId: TEMPLATE_ID,
		})

		expect(workoutFormSchema.safeParse(payload).success).toBe(true)
		expect(JSON.stringify(payload)).not.toContain('planKey')
	})
})
