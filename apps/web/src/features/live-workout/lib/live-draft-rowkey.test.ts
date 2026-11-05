import { liveSetInputSchema, liveWorkoutUpdateSchema } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import {
	LIVE_EDITED_AT,
	LIVE_STARTED_AT,
	makeExercise,
	makeLiveResponse,
	makePlanExercise,
} from '@/shared/testing'

import { adoptServerExercises, buildLiveDraft, toLiveUpdate } from './build-live-draft'
import type { LiveDraft, LiveDraftExercise, LiveDraftSet } from './live-draft.types'
import {
	addSet,
	addWarmup,
	patchSet,
	removeSet,
	restoreSet,
	setSetDone,
	type RemovedSet,
} from './live-draft-edit'

const KEY_1 = '0199b3a4-0000-7000-8000-0000000000d1'
const DONE_AT = '2026-11-02T09:20:00.000Z'

const set = (overrides: Partial<LiveDraftSet> = {}): LiveDraftSet => ({
	rowKey: 'row-a',
	isEdited: false,
	reps: 8,
	weightKg: 50,
	durationSec: 30,
	distanceM: 400,
	isWarmup: false,
	doneAt: null,
	...overrides,
})

const exercise = (overrides: Partial<LiveDraftExercise> = {}): LiveDraftExercise => ({
	rowKey: KEY_1,
	clientKey: KEY_1,
	readOnly: false,
	exerciseId: null,
	templateExerciseId: null,
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	isBodyweight: null,
	durationMin: null,
	distanceM: null,
	sets: [
		set({ rowKey: 'k1' }),
		set({ rowKey: 'k2', isWarmup: true, doneAt: DONE_AT }),
		set({ rowKey: 'k3', reps: 5 }),
	],
	plan: null,
	...overrides,
})

const draftOf = (...exercises: LiveDraftExercise[]): LiveDraft => ({
	workoutId: 'w1',
	templateName: null,
	startedAt: LIVE_STARTED_AT,
	exercises,
})

const keysOf = (draft: LiveDraft, index = 0): string[] =>
	(draft.exercises[index]?.sets ?? []).map(({ rowKey }) => rowKey)

const SET_FIELDS = Object.keys(liveSetInputSchema.shape).sort()

describe('PUT body: no data lost, no rowKey', () => {
	it('every set sends exactly the fields of the schema (nothing dropped, no rowKey)', () => {
		const update = toLiveUpdate(draftOf(exercise()), LIVE_EDITED_AT)

		expect(update.exercises[0]?.sets).toHaveLength(3)
		for (const input of update.exercises) {
			for (const sent of input.sets) {
				expect(Object.keys(sent).sort()).toEqual(SET_FIELDS)
			}
		}
		expect(SET_FIELDS).toEqual(
			['distanceM', 'doneAt', 'durationSec', 'isWarmup', 'reps', 'weightKg'].sort(),
		)
	})

	it('carries the values of each set over unchanged', () => {
		const [input] = toLiveUpdate(draftOf(exercise()), LIVE_EDITED_AT).exercises

		expect(input?.sets).toEqual([
			{ reps: 8, weightKg: 50, durationSec: 30, distanceM: 400, isWarmup: false, doneAt: null },
			{ reps: 8, weightKg: 50, durationSec: 30, distanceM: 400, isWarmup: true, doneAt: DONE_AT },
			{ reps: 5, weightKg: 50, durationSec: 30, distanceM: 400, isWarmup: false, doneAt: null },
		])
	})

	it('the schema accepts the body and the serialized body has no rowKey anywhere', () => {
		const update = toLiveUpdate(draftOf(exercise()), LIVE_EDITED_AT)
		const json = JSON.stringify(update)

		expect(liveWorkoutUpdateSchema.safeParse(update).success).toBe(true)
		expect(json).not.toContain('rowKey')
		expect(json).not.toContain('"k1"')
	})

	it('a snapshot round-trip keeps the values and gives the rebuilt sets fresh unique keys', () => {
		const inputs = toLiveUpdate(draftOf(exercise()), LIVE_EDITED_AT).exercises

		const rebuilt = buildLiveDraft(makeLiveResponse(), { unsent: inputs })

		const keys = keysOf(rebuilt)
		expect(new Set(keys).size).toBe(3)
		expect(keys).not.toContain('k1')
		expect(toLiveUpdate(rebuilt, LIVE_EDITED_AT).exercises).toEqual(inputs)
	})
})

describe('rowKey of a set', () => {
	it('is unique across the sets built from the plan', () => {
		const built = buildLiveDraft(makeLiveResponse({ plan: [makePlanExercise({ sets: 4 })] }))

		const keys = keysOf(built)
		expect(keys).toHaveLength(4)
		expect(new Set(keys).size).toBe(4)
	})

	it('is unique across the sets read from the server', () => {
		const serverSet = {
			reps: 5,
			weightKg: 60,
			durationSec: null,
			distanceM: null,
			isWarmup: false,
			doneAt: DONE_AT,
		}
		const live = makeLiveResponse({
			workout: {
				...makeLiveResponse().workout,
				exercises: [makeExercise({ clientKey: KEY_1, sets: [serverSet, serverSet] })],
			},
		})

		const keys = keysOf(buildLiveDraft(live))

		expect(keys).toHaveLength(2)
		expect(new Set(keys).size).toBe(2)
	})

	it('stays after patchSet and setSetDone (and after taking the tick back)', () => {
		const draft = draftOf(exercise())
		const ref = { exerciseIndex: 0, setIndex: 1 }

		const patched = patchSet(draft, ref, { reps: 12, weightKg: 70 })
		const done = setSetDone(patched, ref, DONE_AT)
		const undone = setSetDone(done, ref, null)

		expect(keysOf(patched)).toEqual(['k1', 'k2', 'k3'])
		expect(keysOf(done)).toEqual(['k1', 'k2', 'k3'])
		expect(keysOf(undone)).toEqual(['k1', 'k2', 'k3'])
		expect(patched.exercises[0]?.sets[1]?.reps).toBe(12)
	})

	it('the others keep theirs after removeSet; restoreSet brings the same key back on its place', () => {
		const draft = draftOf(exercise())
		const removedSet = draft.exercises[0]?.sets[1] as LiveDraftSet
		const removed: RemovedSet = { exerciseKey: KEY_1, setIndex: 1, set: removedSet }

		const after = removeSet(draft, { exerciseIndex: 0, setIndex: 1 })
		const restored = restoreSet(after, removed)

		expect(keysOf(after)).toEqual(['k1', 'k3'])
		expect(keysOf(restored)).toEqual(['k1', 'k2', 'k3'])
	})

	it('addSet gets a new key (not the copied one) and the values of the last working set, not done', () => {
		const draft = draftOf(exercise({ sets: [set({ rowKey: 'k1', doneAt: DONE_AT })] }))

		const added = addSet(draft, 0)

		const keys = keysOf(added)
		expect(keys[0]).toBe('k1')
		expect(keys[1]).toBeTruthy()
		expect(keys[1]).not.toBe('k1')
		expect(added.exercises[0]?.sets[1]).toMatchObject({ reps: 8, weightKg: 50, doneAt: null })
	})

	it('addSet on an exercise without a working set still gets a key', () => {
		const added = addSet(draftOf(exercise({ sets: [] })), 0)

		expect(keysOf(added)[0]).toBeTruthy()
	})

	it('addWarmup puts a new key in front and keeps the old ones', () => {
		const added = addWarmup(draftOf(exercise()), 0)

		const keys = keysOf(added)
		expect(keys.slice(1)).toEqual(['k1', 'k2', 'k3'])
		expect(keys[0]).toBeTruthy()
		expect(new Set(keys).size).toBe(4)
		expect(added.exercises[0]?.sets[0]?.isWarmup).toBe(true)
	})

	it('two addSet calls give two different keys', () => {
		const twice = addSet(addSet(draftOf(exercise({ sets: [set({ rowKey: 'k1' })] })), 0), 0)

		expect(new Set(keysOf(twice)).size).toBe(3)
	})
})

describe('adoptServerExercises keeps the rows by index', () => {
	const serverSet = (weightKg: number) => ({
		reps: 5,
		weightKg,
		durationSec: null,
		distanceM: null,
		isWarmup: false,
		doneAt: null,
	})
	const liveOf = (...sets: ReturnType<typeof serverSet>[]) =>
		makeLiveResponse({
			workout: {
				...makeLiveResponse().workout,
				exercises: [makeExercise({ clientKey: KEY_1, sets })],
			},
		})

	it('the same count: keys stay, values come from the server', () => {
		const adopted = adoptServerExercises(
			draftOf(exercise()),
			liveOf(serverSet(1), serverSet(2), serverSet(3)),
		)

		expect(keysOf(adopted)).toEqual(['k1', 'k2', 'k3'])
		expect(adopted.exercises[0]?.sets.map((s) => s.weightKg)).toEqual([1, 2, 3])
	})

	it('fewer server sets: the first keys stay', () => {
		const adopted = adoptServerExercises(draftOf(exercise()), liveOf(serverSet(1)))

		expect(keysOf(adopted)).toEqual(['k1'])
	})

	it('more server sets: the old keys stay and the extra ones get new, unique keys', () => {
		const adopted = adoptServerExercises(
			draftOf(exercise({ sets: [set({ rowKey: 'k1' })] })),
			liveOf(serverSet(1), serverSet(2), serverSet(3)),
		)

		const keys = keysOf(adopted)
		expect(keys[0]).toBe('k1')
		expect(keys).toHaveLength(3)
		expect(new Set(keys).size).toBe(3)
	})
})
