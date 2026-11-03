import type { WorkoutSetResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { makeExercise } from '@/shared/testing'

import { getDoneWork } from './get-done-work'

const DONE_AT = '2026-11-02T10:00:00.000Z'

const set = (overrides: Partial<WorkoutSetResponse> = {}): WorkoutSetResponse => ({
	reps: 8,
	weightKg: 50,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	doneAt: null,
	...overrides,
})

const live = (sets: WorkoutSetResponse[], id = 'l1') =>
	makeExercise({ id, clientKey: `key-${id}`, sets })

describe('getDoneWork', () => {
	it('a chat exercise (clientKey null) counts entirely even with doneAt null', () => {
		const chat = makeExercise({ clientKey: null, sets: [set(), set()] })

		const result = getDoneWork([chat])

		expect(result).toHaveLength(1)
		expect(result[0]?.sets).toHaveLength(2)
	})

	it('a live exercise keeps only the done sets', () => {
		const exercise = live([set({ doneAt: DONE_AT }), set(), set({ doneAt: DONE_AT })])

		const result = getDoneWork([exercise])

		expect(result[0]?.sets).toHaveLength(2)
		expect(result[0]?.sets.every((item) => item.doneAt !== null)).toBe(true)
	})

	it('a live exercise without a done set is skipped', () => {
		expect(getDoneWork([live([set(), set()]), live([])])).toEqual([])
	})

	it('live cardio stays only with minutes or distance', () => {
		const cardio = (durationMin: number | null, distanceM: number | null) =>
			makeExercise({ kind: 'CARDIO', clientKey: 'k', sets: [], durationMin, distanceM })

		expect(getDoneWork([cardio(null, null), cardio(0, 0)])).toEqual([])
		expect(getDoneWork([cardio(10, null)])).toHaveLength(1)
		expect(getDoneWork([cardio(null, 2000)])).toHaveLength(1)
	})

	it('does not mutate the input and keeps the order', () => {
		const first = live([set({ doneAt: DONE_AT }), set()], 'a')
		const second = makeExercise({ id: 'b', clientKey: null })

		const result = getDoneWork([first, second])

		expect(result.map((item) => item.id)).toEqual(['a', 'b'])
		expect(first.sets).toHaveLength(2)
	})
})
