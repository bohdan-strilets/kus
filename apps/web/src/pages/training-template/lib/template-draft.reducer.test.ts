import { describe, expect, it } from 'vitest'

import { makeDraft, makeTarget } from './fixtures'
import { hasDraftChanges, toSaveExercises } from './template-draft'
import { moveExercise, templateDraftReducer } from './template-draft.reducer'

const list = [makeDraft('a'), makeDraft('b'), makeDraft('c')]
const keys = (items: readonly { key: string }[]): string[] => items.map((item) => item.key)

describe('moveExercise', () => {
	it('moves a row one step down and up', () => {
		expect(keys(moveExercise(list, 'a', 1))).toEqual(['b', 'a', 'c'])
		expect(keys(moveExercise(list, 'c', -1))).toEqual(['a', 'c', 'b'])
	})

	it('keeps the order at the ends and for an unknown key', () => {
		expect(keys(moveExercise(list, 'a', -1))).toEqual(['a', 'b', 'c'])
		expect(keys(moveExercise(list, 'c', 1))).toEqual(['a', 'b', 'c'])
		expect(keys(moveExercise(list, 'zzz', 1))).toEqual(['a', 'b', 'c'])
	})

	it('does not change the list it was given', () => {
		moveExercise(list, 'a', 1)

		expect(keys(list)).toEqual(['a', 'b', 'c'])
	})
})

describe('templateDraftReducer', () => {
	it('reorders by the keys a drag reports', () => {
		const next = templateDraftReducer(list, { type: 'reorder', keys: ['c', 'a', 'b'] })

		expect(keys(next)).toEqual(['c', 'a', 'b'])
	})

	it('ignores a reorder that lost or invented a row', () => {
		const lost = templateDraftReducer(list, { type: 'reorder', keys: ['c', 'a'] })
		const invented = templateDraftReducer(list, { type: 'reorder', keys: ['c', 'a', 'x'] })

		expect(keys(lost)).toEqual(['a', 'b', 'c'])
		expect(keys(invented)).toEqual(['a', 'b', 'c'])
	})

	it('removes a row', () => {
		expect(keys(templateDraftReducer(list, { type: 'remove', key: 'b' }))).toEqual(['a', 'c'])
	})

	it('replaces the target of one row only', () => {
		const target = makeTarget({ sets: 5 })

		const next = templateDraftReducer(list, { type: 'setTarget', key: 'b', target })

		expect(next.map((item) => item.target.sets)).toEqual([3, 5, 3])
	})

	it('adds a row at the end and resets to a new list', () => {
		const added = templateDraftReducer(list, { type: 'add', exercise: makeDraft('d') })
		const reset = templateDraftReducer(added, { type: 'reset', exercises: [makeDraft('z')] })

		expect(keys(added)).toEqual(['a', 'b', 'c', 'd'])
		expect(keys(reset)).toEqual(['z'])
	})
})

describe('template draft helpers', () => {
	it('builds the request exercises without the keys of the screen', () => {
		const [first] = toSaveExercises([makeDraft('a', { lastSets: [] })])

		expect(first).toEqual({
			name: 'Вправа a',
			exerciseId: null,
			kind: 'STRENGTH',
			muscleGroup: 'CHEST',
			target: makeTarget(),
		})
	})

	it('sees an order change, a target change and no change', () => {
		const retargeted = templateDraftReducer(list, {
			type: 'setTarget',
			key: 'a',
			target: makeTarget({ sets: 4 }),
		})

		expect(hasDraftChanges(list, [...list])).toBe(false)
		expect(hasDraftChanges(list, moveExercise(list, 'a', 1))).toBe(true)
		expect(hasDraftChanges(list, retargeted)).toBe(true)
	})

	it('does not count the last result as a change', () => {
		const withLast = list.map((item) => ({ ...item, lastSets: [] }))

		expect(hasDraftChanges(list, withLast)).toBe(false)
	})
})
