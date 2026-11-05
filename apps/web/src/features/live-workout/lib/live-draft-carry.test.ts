import { describe, expect, it } from 'vitest'

import { LIVE_STARTED_AT } from '@/shared/testing'

import { toLiveExerciseInputs } from './build-live-draft'
import type { LiveDraft, LiveDraftExercise, LiveDraftSet } from './live-draft.types'
import { carryDoneSetForward, patchSet, setSetDone } from './live-draft-edit'

const DONE_AT = '2026-11-02T09:20:00.000Z'
const KEY = '0199b3a4-0000-7000-8000-0000000000d1'

const makeSet = (overrides: Partial<LiveDraftSet> = {}): LiveDraftSet => ({
	rowKey: crypto.randomUUID(),
	reps: 8,
	weightKg: 70,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	isEdited: false,
	doneAt: null,
	...overrides,
})

const makeDraft = (
	sets: LiveDraftSet[],
	overrides: Partial<LiveDraftExercise> = {},
): LiveDraft => ({
	workoutId: 'w1',
	templateName: null,
	startedAt: LIVE_STARTED_AT,
	exercises: [
		{
			rowKey: KEY,
			clientKey: KEY,
			readOnly: false,
			exerciseId: null,
			templateExerciseId: null,
			name: 'Жим лежачи',
			kind: 'STRENGTH',
			muscleGroup: 'CHEST',
			isBodyweight: null,
			durationMin: null,
			distanceM: null,
			sets,
			plan: null,
			...overrides,
		},
	],
})

const sets = (draft: LiveDraft): LiveDraftSet[] => draft.exercises[0]?.sets ?? []

const markDone = (draft: LiveDraft, setIndex: number): LiveDraft =>
	carryDoneSetForward(setSetDone(draft, { exerciseIndex: 0, setIndex }, DONE_AT), {
		exerciseIndex: 0,
		setIndex,
	})

describe('carryDoneSetForward', () => {
	it('the author scenario: 70, set 2 changed to 80 and done, set 3 shows 80', () => {
		let draft = makeDraft([makeSet(), makeSet(), makeSet()])
		draft = markDone(draft, 0)
		draft = patchSet(draft, { exerciseIndex: 0, setIndex: 1 }, { weightKg: 80 })
		draft = markDone(draft, 1)

		expect(sets(draft).map((s) => s.weightKg)).toEqual([70, 80, 80])
	})

	it('keeps a set the person edited by hand', () => {
		let draft = makeDraft([makeSet(), makeSet(), makeSet()])
		draft = patchSet(draft, { exerciseIndex: 0, setIndex: 2 }, { weightKg: 75 })
		draft = patchSet(draft, { exerciseIndex: 0, setIndex: 1 }, { weightKg: 80 })
		draft = markDone(draft, 1)

		expect(sets(draft).map((s) => s.weightKg)).toEqual([70, 80, 75])
	})

	it('carries reps too, and the next working set skips a done one', () => {
		let draft = makeDraft([
			makeSet({ reps: 10 }),
			makeSet({ doneAt: DONE_AT, reps: 6, isEdited: true }),
			makeSet({ reps: 6 }),
		])
		draft = markDone(draft, 0)

		expect(sets(draft).map((s) => s.reps)).toEqual([10, 6, 10])
	})

	it('chains 2 -> 3 -> 4 because a carried value is not a hand edit', () => {
		let draft = makeDraft([makeSet(), makeSet(), makeSet(), makeSet()])
		draft = patchSet(draft, { exerciseIndex: 0, setIndex: 1 }, { weightKg: 80, reps: 6 })
		draft = markDone(draft, 1)
		draft = markDone(draft, 2)

		expect(sets(draft).map((s) => [s.reps, s.weightKg])).toEqual([
			[8, 70],
			[6, 80],
			[6, 80],
			[6, 80],
		])
		expect(sets(draft)[2]?.isEdited).toBe(false)
	})

	it('a warm-up carries nothing', () => {
		let draft = makeDraft([makeSet({ isWarmup: true, weightKg: 20, reps: 12 }), makeSet()])
		draft = markDone(draft, 0)

		expect(sets(draft)[1]).toMatchObject({ weightKg: 70, reps: 8 })
	})

	it('a warm-up after the done set is not a target', () => {
		let draft = makeDraft([makeSet({ weightKg: 90 }), makeSet({ isWarmup: true, weightKg: 20 })])
		draft = markDone(draft, 0)

		expect(sets(draft)[1]?.weightKg).toBe(20)
	})

	it('the last set carries nothing', () => {
		const draft = makeDraft([makeSet({ doneAt: DONE_AT }), makeSet({ weightKg: 90 })])

		expect(markDone(draft, 1)).toEqual(
			setSetDone(draft, { exerciseIndex: 0, setIndex: 1 }, DONE_AT),
		)
	})

	it('removing the check carries nothing', () => {
		const draft = makeDraft([makeSet({ weightKg: 90 }), makeSet()])

		expect(carryDoneSetForward(draft, { exerciseIndex: 0, setIndex: 0 })).toBe(draft)
	})

	it('a bodyweight exercise carries no weight', () => {
		let draft = makeDraft([makeSet({ weightKg: 5 }), makeSet({ weightKg: null })], {
			isBodyweight: true,
		})
		draft = markDone(draft, 0)

		expect(sets(draft)[1]).toMatchObject({ weightKg: null, reps: 8 })
	})

	it('the flag is not in the payload', () => {
		let draft = makeDraft([makeSet(), makeSet()])
		draft = patchSet(draft, { exerciseIndex: 0, setIndex: 1 }, { weightKg: 80 })

		const [input] = toLiveExerciseInputs(draft)
		expect(sets(draft)[1]?.isEdited).toBe(true)
		expect(input?.sets.every((s) => !('isEdited' in s) && !('rowKey' in s))).toBe(true)
	})
})
