import { describe, expect, it } from 'vitest'

import type { LiveDraft, LiveDraftExercise, LiveDraftSet } from './live-draft.types'
import {
	removeExercise,
	removeSet,
	restoreExercise,
	restoreSet,
	type RemovedSet,
} from './live-draft-edit'
import {
	findNextTodoRef,
	shiftRefAfterExerciseRemoval,
	shiftRefAfterSetRemoval,
} from './live-set-helpers'

const DONE_AT = '2026-11-02T09:00:00.000Z'

const set = (overrides: Partial<LiveDraftSet> = {}): LiveDraftSet => ({
	rowKey: 'set-key',
	reps: 8,
	weightKg: 50,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	doneAt: null,
	...overrides,
})

const exercise = (key: string, overrides: Partial<LiveDraftExercise> = {}): LiveDraftExercise => ({
	rowKey: key,
	clientKey: key,
	readOnly: false,
	exerciseId: null,
	templateExerciseId: null,
	name: key,
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	isBodyweight: null,
	durationMin: null,
	distanceM: null,
	sets: [set({ reps: 1 }), set({ reps: 2 }), set({ reps: 3 })],
	plan: null,
	...overrides,
})

const chatExercise = (key: string): LiveDraftExercise =>
	exercise(key, { readOnly: true, clientKey: null })

const draftOf = (...exercises: LiveDraftExercise[]): LiveDraft => ({
	workoutId: 'w',
	templateName: null,
	startedAt: null,
	exercises,
})

const repsOf = (draft: LiveDraft, index: number): (number | null)[] =>
	draft.exercises[index]?.sets.map(({ reps }) => reps) ?? []

const keysOf = (draft: LiveDraft): string[] => draft.exercises.map(({ rowKey }) => rowKey)

describe('removeSet / restoreSet', () => {
	it('removes the set at the index and restores it on the same place', () => {
		const draft = draftOf(exercise('a'))
		const removedSet = draft.exercises[0]?.sets[1] as LiveDraftSet
		const removed: RemovedSet = { exerciseKey: 'a', setIndex: 1, set: removedSet }

		const without = removeSet(draft, { exerciseIndex: 0, setIndex: 1 })
		expect(repsOf(without, 0)).toEqual([1, 3])

		const back = restoreSet(without, removed)
		expect(repsOf(back, 0)).toEqual([1, 2, 3])
		expect(back.exercises[0]?.sets[1]).toBe(removedSet)
	})

	it('keeps doneAt and isWarmup of the restored set', () => {
		const warm = set({ isWarmup: true, doneAt: DONE_AT, reps: 5 })
		const draft = draftOf(exercise('a', { sets: [warm, set()] }))

		const back = restoreSet(removeSet(draft, { exerciseIndex: 0, setIndex: 0 }), {
			exerciseKey: 'a',
			setIndex: 0,
			set: warm,
		})

		expect(back.exercises[0]?.sets[0]).toEqual(warm)
	})

	it('clamps the index when sets went meanwhile', () => {
		const draft = draftOf(exercise('a', { sets: [set({ reps: 1 })] }))
		const back = restoreSet(draft, { exerciseKey: 'a', setIndex: 5, set: set({ reps: 9 }) })
		expect(repsOf(back, 0)).toEqual([1, 9])
	})

	it('finds the exercise by key, not by index (the list moved)', () => {
		const draft = draftOf(exercise('b'), exercise('a', { sets: [set({ reps: 1 })] }))
		const back = restoreSet(draft, { exerciseKey: 'a', setIndex: 0, set: set({ reps: 9 }) })
		expect(repsOf(back, 1)).toEqual([9, 1])
		expect(repsOf(back, 0)).toEqual([1, 2, 3])
	})

	it('a gone exercise takes nothing back', () => {
		const draft = draftOf(exercise('b'))
		expect(restoreSet(draft, { exerciseKey: 'a', setIndex: 0, set: set() })).toBe(draft)
	})

	it('a chat (read only) exercise loses no set', () => {
		const draft = draftOf(chatExercise('a'))
		expect(repsOf(removeSet(draft, { exerciseIndex: 0, setIndex: 0 }), 0)).toEqual([1, 2, 3])
	})

	it('does not touch the other exercises or mutate the input', () => {
		const draft = draftOf(exercise('a'), exercise('b'))
		const result = removeSet(draft, { exerciseIndex: 0, setIndex: 0 })
		expect(repsOf(result, 1)).toEqual([1, 2, 3])
		expect(repsOf(draft, 0)).toEqual([1, 2, 3])
	})

	it('an index past the end removes nothing', () => {
		const draft = draftOf(exercise('a'))
		expect(repsOf(removeSet(draft, { exerciseIndex: 0, setIndex: 9 }), 0)).toEqual([1, 2, 3])
	})
})

describe('removeExercise / restoreExercise', () => {
	it('removes the exercise and restores it on its index with the same keys', () => {
		const middle = exercise('b')
		const draft = draftOf(exercise('a'), middle, exercise('c'))

		const without = removeExercise(draft, 1)
		expect(keysOf(without)).toEqual(['a', 'c'])

		const back = restoreExercise(without, { index: 1, exercise: middle })
		expect(keysOf(back)).toEqual(['a', 'b', 'c'])
		expect(back.exercises[1]?.clientKey).toBe('b')
		expect(back.exercises[1]).toBe(middle)
	})

	it('a chat exercise is not removed', () => {
		const draft = draftOf(chatExercise('a'))
		expect(removeExercise(draft, 0)).toBe(draft)
	})

	it('an index with no exercise changes nothing', () => {
		const draft = draftOf(exercise('a'))
		expect(removeExercise(draft, 4)).toBe(draft)
	})

	it('a second restore adds no duplicate', () => {
		const removed = exercise('b')
		const once = restoreExercise(draftOf(exercise('a')), { index: 1, exercise: removed })
		const twice = restoreExercise(once, { index: 1, exercise: removed })
		expect(twice.exercises).toHaveLength(2)
		expect(twice).toBe(once)
	})

	it('clamps the index to the end of a shorter list', () => {
		const back = restoreExercise(draftOf(exercise('a')), { index: 7, exercise: exercise('z') })
		expect(keysOf(back)).toEqual(['a', 'z'])
	})

	it('restores to the front for index 0', () => {
		const back = restoreExercise(draftOf(exercise('a')), { index: 0, exercise: exercise('z') })
		expect(keysOf(back)).toEqual(['z', 'a'])
	})
})

describe('shiftRefAfterSetRemoval', () => {
	const removed = { exerciseIndex: 1, setIndex: 2 }

	it('null stays null', () => {
		expect(shiftRefAfterSetRemoval(null, removed)).toBeNull()
	})

	it('another exercise is left alone', () => {
		const selected = { exerciseIndex: 0, setIndex: 5 }
		expect(shiftRefAfterSetRemoval(selected, removed)).toBe(selected)
	})

	it('the removed set is forgotten', () => {
		expect(shiftRefAfterSetRemoval({ exerciseIndex: 1, setIndex: 2 }, removed)).toBeNull()
	})

	it('later sets move up, earlier ones stay', () => {
		expect(shiftRefAfterSetRemoval({ exerciseIndex: 1, setIndex: 3 }, removed)).toEqual({
			exerciseIndex: 1,
			setIndex: 2,
		})
		const before = { exerciseIndex: 1, setIndex: 1 }
		expect(shiftRefAfterSetRemoval(before, removed)).toBe(before)
	})
})

describe('shiftRefAfterExerciseRemoval', () => {
	it('null stays null; the removed exercise is forgotten', () => {
		expect(shiftRefAfterExerciseRemoval(null, 1)).toBeNull()
		expect(shiftRefAfterExerciseRemoval({ exerciseIndex: 1, setIndex: 0 }, 1)).toBeNull()
	})

	it('later exercises move up, earlier ones stay', () => {
		expect(shiftRefAfterExerciseRemoval({ exerciseIndex: 3, setIndex: 2 }, 1)).toEqual({
			exerciseIndex: 2,
			setIndex: 2,
		})
		const before = { exerciseIndex: 0, setIndex: 2 }
		expect(shiftRefAfterExerciseRemoval(before, 1)).toBe(before)
	})
})

describe('findNextTodoRef', () => {
	const done = set({ doneAt: DONE_AT })

	it('is the first set to do of the first exercise with work from the index', () => {
		const draft = draftOf(
			exercise('a', { sets: [done, set()] }),
			exercise('b', { sets: [done, done, set()] }),
		)
		expect(findNextTodoRef(draft, 0)).toEqual({ exerciseIndex: 0, setIndex: 1 })
		expect(findNextTodoRef(draft, 1)).toEqual({ exerciseIndex: 1, setIndex: 2 })
	})

	it('skips finished and chat exercises', () => {
		const draft = draftOf(exercise('a', { sets: [done] }), chatExercise('chat'), exercise('c'))
		expect(findNextTodoRef(draft, 0)).toEqual({ exerciseIndex: 2, setIndex: 0 })
	})

	it('cardio without minutes is to do, with minutes it is done', () => {
		const todo = exercise('run', { kind: 'CARDIO', sets: [], durationMin: null })
		expect(findNextTodoRef(draftOf(todo), 0)).toEqual({ exerciseIndex: 0, setIndex: 0 })
		expect(findNextTodoRef(draftOf({ ...todo, durationMin: 20 }), 0)).toBeNull()
	})

	it('null when nothing is left, or from past the end', () => {
		expect(findNextTodoRef(draftOf(exercise('a', { sets: [done] })), 0)).toBeNull()
		expect(findNextTodoRef(draftOf(exercise('a')), 3)).toBeNull()
		expect(findNextTodoRef(draftOf(), 0)).toBeNull()
	})
})
