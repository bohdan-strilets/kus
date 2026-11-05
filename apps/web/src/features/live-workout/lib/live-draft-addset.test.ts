import { describe, expect, it } from 'vitest'

import { LIVE_STARTED_AT } from '@/shared/testing'

import type { LiveDraft, LiveDraftSet } from './live-draft.types'
import { addSet, carryDoneSetForward, patchSet, setSetDone } from './live-draft-edit'

const KEY = '0199b3a4-0000-7000-8000-0000000000d2'
const DONE_AT = '2026-11-02T09:20:00.000Z'

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

const makeDraft = (sets: LiveDraftSet[]): LiveDraft => ({
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
		},
	],
})

const sets = (draft: LiveDraft): LiveDraftSet[] => draft.exercises[0]?.sets ?? []

describe('addSet and the hand-edit flag', () => {
	it('a new set starts as not edited even when the last set was edited by hand', () => {
		let draft = makeDraft([makeSet(), makeSet(), makeSet()])
		draft = patchSet(draft, { exerciseIndex: 0, setIndex: 2 }, { weightKg: 75 })
		expect(sets(draft)[2]?.isEdited).toBe(true)

		draft = addSet(draft, 0)

		expect(sets(draft)).toHaveLength(4)
		expect(sets(draft)[3]?.isEdited).toBeFalsy()
	})

	it('the new set receives the weight of the done set before it', () => {
		let draft = makeDraft([makeSet(), makeSet(), makeSet()])
		draft = patchSet(draft, { exerciseIndex: 0, setIndex: 2 }, { weightKg: 75 })
		draft = addSet(draft, 0)
		draft = patchSet(draft, { exerciseIndex: 0, setIndex: 2 }, { weightKg: 90 })
		draft = setSetDone(draft, { exerciseIndex: 0, setIndex: 2 }, DONE_AT)
		draft = carryDoneSetForward(draft, { exerciseIndex: 0, setIndex: 2 })

		expect(sets(draft)[3]?.weightKg).toBe(90)
	})
})
