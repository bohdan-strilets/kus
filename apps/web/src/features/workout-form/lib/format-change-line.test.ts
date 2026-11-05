import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeTemplate, makeTemplateExercise } from '@/shared/testing'

import { buildFormDraft, getChangedSetNumbers, getExerciseState } from './build-form-draft'
import { addFormSet, patchFormSet, removeFormSet } from './form-exercise-edit'
import { formatChangeLine } from './format-change-line'
import type { FormExerciseValue } from './workout-form.types'

const NOW = { localDate: '2026-11-02', time: '18:30' }
const t = i18n.t.bind(i18n)

/** `count` working sets of 66 kg × 12 (a different reps value per set is set by the caller). */
const planned = (count = 3, kind: 'STRENGTH' | 'CARDIO' = 'STRENGTH'): FormExerciseValue => {
	const target = makeTemplateExercise().target
	const exercise = makeTemplateExercise({
		kind,
		target: { ...target, sets: count, repsMin: 12, repsMax: 12, weightKg: 66, durationMin: 20 },
	})
	const draft = buildFormDraft(makeTemplate({ exercises: [exercise] }), { now: NOW })
	return draft.exercises[0] as FormExerciseValue
}

const withDistinctReps = (exercise: FormExerciseValue): FormExerciseValue => {
	const reps = (index: number): number => 10 + index
	return {
		...exercise,
		sets: exercise.sets.map((set, index) => ({ ...set, reps: reps(index) })),
		plan: exercise.plan && {
			...exercise.plan,
			sets: exercise.plan.sets.map((set, index) => ({ ...set, reps: reps(index) })),
		},
	}
}

describe('formatChangeLine: branches', () => {
	it('changedNoSets: no sets at all', () => {
		expect(formatChangeLine({ ...planned(), sets: [] }, t)).toBe(
			'Змінено: без підходів · план: 3 підходи · 66 кг × 12',
		)
	})

	it('only warm-ups left counts as no working sets', () => {
		const exercise = planned()
		const sets = exercise.sets.map((set) => ({ ...set, isWarmup: true }))

		expect(formatChangeLine({ ...exercise, sets }, t)).toBe(
			'Змінено: без підходів · план: 3 підходи · 66 кг × 12',
		)
	})

	it('changedBoth: fewer sets and a changed one', () => {
		const exercise = patchFormSet(removeFormSet(withDistinctReps(planned()), 0), 0, { reps: 99 })

		expect(formatChangeLine(exercise, t)).toBe(
			'Змінено: 2 підходи замість 3, 1-й підхід · план: 3 підходи · 66 кг × 10',
		)
	})

	it('changedOnlyCount: a different number, nothing else', () => {
		expect(formatChangeLine(removeFormSet(planned(), 0), t)).toBe('Змінено: 2 підходи замість 3')
	})

	it('changed: only values differ, two sets joined with «і»', () => {
		const base = withDistinctReps(planned())
		const exercise = patchFormSet(patchFormSet(base, 1, { reps: 1 }), 2, { reps: 2 })

		expect(formatChangeLine(exercise, t)).toBe(
			'Змінено: 2-й і 3-й підходи · план: 3 підходи · 66 кг × 10',
		)
	})

	it('null: nothing differs', () => {
		expect(formatChangeLine(planned(), t)).toBeNull()
	})

	it('null: cardio has no sets to compare', () => {
		const cardio = planned(3, 'CARDIO')

		expect(formatChangeLine({ ...cardio, durationMin: 5 }, t)).toBeNull()
	})

	it('null: an added exercise has no plan', () => {
		expect(formatChangeLine({ ...planned(), plan: null }, t)).toBeNull()
	})
})

describe('formatChangeLine: plural forms', () => {
	it('count: one / few / many', () => {
		const base = planned(3)
		const one = removeFormSet(removeFormSet(base, 0), 0)
		const four = addFormSet(base)
		const five = addFormSet(addFormSet(base))

		expect(formatChangeLine(one, t)).toBe('Змінено: 1 підхід замість 3')
		expect(formatChangeLine(four, t)).toBe('Змінено: 4 підходи замість 3')
		expect(formatChangeLine(five, t)).toBe('Змінено: 5 підходів замість 3')
	})

	it('changed sets: one / few / many', () => {
		const base = withDistinctReps(planned(5))
		const edit = (exercise: FormExerciseValue, indexes: number[]): FormExerciseValue =>
			indexes.reduce((acc, index) => patchFormSet(acc, index, { reps: 1 }), exercise)

		expect(formatChangeLine(edit(base, [1]), t)).toContain('Змінено: 2-й підхід · ')
		expect(formatChangeLine(edit(base, [0, 1, 2]), t)).toContain(
			'Змінено: 1-й, 2-й і 3-й підходи · ',
		)
		expect(formatChangeLine(edit(base, [0, 1, 2, 3, 4]), t)).toContain(
			'Змінено: 1-й, 2-й, 3-й, 4-й і 5-й підходів · ',
		)
	})
})

describe('formatChangeLine: deleting a warm-up only', () => {
	it('the card is CHANGED but there is no line saying what changed (pins current behaviour)', () => {
		const exercise = planned()
		const mark = (sets: FormExerciseValue['sets']): FormExerciseValue['sets'] =>
			sets.map((set, index) => (index === 0 ? { ...set, isWarmup: true } : set))
		const withWarmup: FormExerciseValue = {
			...exercise,
			sets: mark(exercise.sets),
			plan: exercise.plan && { ...exercise.plan, sets: mark(exercise.plan.sets) },
		}

		const removed = removeFormSet(withWarmup, 0)

		expect(getExerciseState(withWarmup)).toBe('PLANNED')
		expect(getExerciseState(removed)).toBe('CHANGED')
		expect(getChangedSetNumbers(removed)).toEqual([])
		expect(formatChangeLine(removed, t)).toBeNull()
	})
})
