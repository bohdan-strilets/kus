import { formSetInputSchema, workoutFormSchema } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { makeTemplate, makeTemplateExercise, TEMPLATE_ID } from '@/shared/testing'

import {
	buildFormDraft,
	getChangedSetNumbers,
	getExerciseState,
	restorePlan,
} from './build-form-draft'
import { buildFormPayload } from './build-form-payload'
import { addFormSet, patchFormSet, removeFormSet, restoreFormSet } from './form-exercise-edit'
import type { FormExerciseValue, FormSetValue } from './workout-form.types'

const NOW = { localDate: '2026-11-02', time: '18:30' }
const REQUEST_ID = '0199b3a4-0000-7000-8000-0000000000d0'

const plannedExercise = (): FormExerciseValue => {
	const draft = buildFormDraft(makeTemplate({ exercises: [makeTemplateExercise()] }), { now: NOW })
	return draft.exercises[0] as FormExerciseValue
}

const keysOf = (exercise: FormExerciseValue): string[] => exercise.sets.map(({ rowKey }) => rowKey)

const set = (overrides: Partial<FormSetValue> = {}): FormSetValue => ({
	rowKey: 'row-a',
	reps: 8,
	weightKg: 50,
	durationSec: 30,
	distanceM: 400,
	isWarmup: false,
	...overrides,
})

const withSets = (...sets: FormSetValue[]): FormExerciseValue => ({
	...plannedExercise(),
	sets,
})

const payloadOf = (exercise: FormExerciseValue) =>
	buildFormPayload({
		values: { localDate: '2026-11-02', startTime: '18:30', durationMin: 55, exercises: [exercise] },
		clientRequestId: REQUEST_ID,
		templateId: TEMPLATE_ID,
	})

describe('POST body: no data lost, no rowKey', () => {
	it('every set sends exactly the fields of the schema', () => {
		const payload = payloadOf(
			withSets(set({ rowKey: 'k1' }), set({ rowKey: 'k2', isWarmup: true })),
		)

		const sets = payload.exercises[0]?.sets ?? []
		expect(sets).toHaveLength(2)
		for (const sent of sets) {
			expect(Object.keys(sent).sort()).toEqual(Object.keys(formSetInputSchema.shape).sort())
		}
	})

	it('carries reps, weight, duration, distance and warm-up over unchanged', () => {
		const payload = payloadOf(
			withSets(
				set({ rowKey: 'k1' }),
				set({
					rowKey: 'k2',
					reps: null,
					weightKg: 0,
					durationSec: null,
					distanceM: null,
					isWarmup: true,
				}),
			),
		)

		expect(payload.exercises[0]?.sets).toEqual([
			{ reps: 8, weightKg: 50, durationSec: 30, distanceM: 400, isWarmup: false },
			{ reps: null, weightKg: 0, durationSec: null, distanceM: null, isWarmup: true },
		])
	})

	it('the schema accepts the body and the JSON has no rowKey', () => {
		const payload = payloadOf(withSets(set({ rowKey: 'secret-key' })))

		expect(workoutFormSchema.safeParse(payload).success).toBe(true)
		expect(JSON.stringify(payload)).not.toContain('rowKey')
		expect(JSON.stringify(payload)).not.toContain('secret-key')
	})

	it('a bodyweight exercise sends weightKg null but keeps the other fields', () => {
		const payload = payloadOf({ ...withSets(set()), isBodyweight: true })

		expect(payload.exercises[0]?.sets[0]).toEqual({
			reps: 8,
			weightKg: null,
			durationSec: 30,
			distanceM: 400,
			isWarmup: false,
		})
	})
})

describe('rowKey of a form set', () => {
	it('is unique across all sets of all exercises of a draft', () => {
		const draft = buildFormDraft(
			makeTemplate({ exercises: [makeTemplateExercise(), makeTemplateExercise()] }),
			{ now: NOW },
		)

		const keys = draft.exercises.flatMap(keysOf)

		expect(keys.length).toBeGreaterThanOrEqual(6)
		expect(new Set(keys).size).toBe(keys.length)
	})

	it('the plan copy and the working sets do not share keys', () => {
		const exercise = plannedExercise()

		const planKeys = (exercise.plan?.sets ?? []).map(({ rowKey }) => rowKey)

		expect(planKeys.filter((key) => keysOf(exercise).includes(key))).toEqual([])
	})

	it('stays after patchFormSet', () => {
		const exercise = withSets(set({ rowKey: 'k1' }), set({ rowKey: 'k2' }))

		expect(keysOf(patchFormSet(exercise, 1, { reps: 12 }))).toEqual(['k1', 'k2'])
	})

	it('removeFormSet keeps the others; restoreFormSet brings the same key back on its place', () => {
		const exercise = withSets(set({ rowKey: 'k1' }), set({ rowKey: 'k2' }), set({ rowKey: 'k3' }))
		const removed = exercise.sets[1] as FormSetValue

		const after = removeFormSet(exercise, 1)
		const restored = restoreFormSet(after, 1, removed)

		expect(keysOf(after)).toEqual(['k1', 'k3'])
		expect(keysOf(restored)).toEqual(['k1', 'k2', 'k3'])
	})

	it('addFormSet gets a new key and copies the values of the last working set', () => {
		const added = addFormSet(withSets(set({ rowKey: 'k1', reps: 9 })))

		const keys = keysOf(added)
		expect(keys[0]).toBe('k1')
		expect(keys[1]).toBeTruthy()
		expect(keys[1]).not.toBe('k1')
		expect(added.sets[1]?.reps).toBe(9)
	})

	it('addFormSet twice gives different keys; with no sets it still gets one', () => {
		const twice = addFormSet(addFormSet(withSets(set({ rowKey: 'k1' }))))
		const fromEmpty = addFormSet(withSets())

		expect(new Set(keysOf(twice)).size).toBe(3)
		expect(keysOf(fromEmpty)[0]).toBeTruthy()
	})

	it('restorePlan gives new keys: different from the old ones, from the plan and between calls', () => {
		const exercise = plannedExercise()
		const before = keysOf(exercise)
		const planKeys = (exercise.plan?.sets ?? []).map(({ rowKey }) => rowKey)

		const first = keysOf(restorePlan(exercise))
		const second = keysOf(restorePlan(exercise))

		expect(first).toHaveLength(before.length)
		expect(first.filter((key) => before.includes(key) || planKeys.includes(key))).toEqual([])
		expect(second.filter((key) => first.includes(key))).toEqual([])
	})
})

describe('the plan comparison ignores rowKey', () => {
	it('sets with other keys but the same values are still «as planned»', () => {
		const exercise = plannedExercise()
		const rekeyed = {
			...exercise,
			sets: exercise.sets.map((s, index) => ({ ...s, rowKey: `other-${index}` })),
		}

		expect(getChangedSetNumbers(rekeyed)).toEqual([])
		expect(getExerciseState(rekeyed)).toBe('PLANNED')
	})

	it('a changed value is found by position whatever the keys are', () => {
		const exercise = plannedExercise()
		const changed = patchFormSet(exercise, 1, { reps: 99 })

		expect(getChangedSetNumbers(changed)).toEqual([2])
		expect(getExerciseState(changed)).toBe('CHANGED')
	})

	it('an extra set counts as changed; a restored plan is PLANNED again', () => {
		const exercise = addFormSet(plannedExercise())

		expect(getChangedSetNumbers(exercise)).toEqual([exercise.sets.length])
		expect(getExerciseState(restorePlan(exercise))).toBe('PLANNED')
	})
})
