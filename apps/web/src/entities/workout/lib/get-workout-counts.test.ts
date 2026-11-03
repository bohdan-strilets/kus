import { describe, expect, it } from 'vitest'

import { makeExercise } from '@/shared/testing'

import { getWorkoutCounts } from './get-workout-counts'

const cardio = (durationMin: number | null) =>
	makeExercise({ kind: 'CARDIO', sets: [], durationMin })

describe('getWorkoutCounts', () => {
	it('counts strength exercises and working sets; warm-ups stay out', () => {
		const warmup = {
			reps: 10,
			weightKg: 40,
			durationSec: null,
			distanceM: null,
			isWarmup: true,
			doneAt: null,
		}
		const [work] = makeExercise().sets
		const counts = getWorkoutCounts([
			makeExercise({ sets: [warmup, ...makeExercise().sets] }),
			makeExercise({ sets: work ? [work] : [] }),
		])

		expect(counts).toMatchObject({ exerciseCount: 2, setCount: 4, hasCardio: false })
	})

	it('keeps cardio apart and sums its named minutes', () => {
		const counts = getWorkoutCounts([makeExercise(), cardio(15), cardio(10)])

		expect(counts).toEqual({ exerciseCount: 1, setCount: 3, cardioMinutes: 25, hasCardio: true })
	})

	it('cardio without minutes: present, minutes null; nothing at all: zeros', () => {
		expect(getWorkoutCounts([cardio(null)])).toMatchObject({ cardioMinutes: null, hasCardio: true })
		expect(getWorkoutCounts([])).toEqual({
			exerciseCount: 0,
			setCount: 0,
			cardioMinutes: null,
			hasCardio: false,
		})
	})
})

describe('getWorkoutCounts: live sessions', () => {
	const planned = (doneAt: string | null) => ({
		reps: 8,
		weightKg: 50,
		durationSec: null,
		distanceM: null,
		isWarmup: false,
		doneAt,
	})
	const DONE_AT = '2026-11-02T10:00:00.000Z'

	it('planned sets of an open live session stay out; equals the numbers after cleanup', () => {
		const exercises = [
			makeExercise({
				id: 'a',
				clientKey: 'ka',
				sets: [planned(DONE_AT), planned(DONE_AT), planned(null)],
			}),
			makeExercise({ id: 'b', clientKey: 'kb', sets: [planned(null), planned(null)] }),
		]

		expect(getWorkoutCounts(exercises)).toMatchObject({ exerciseCount: 1, setCount: 2 })
	})

	it('a done warm-up is not a working set, but the exercise still counts', () => {
		const counts = getWorkoutCounts([
			makeExercise({
				clientKey: 'k',
				sets: [{ ...planned(DONE_AT), isWarmup: true }, planned(DONE_AT)],
			}),
		])

		expect(counts).toMatchObject({ exerciseCount: 1, setCount: 1 })
	})

	it('chat exercises count with doneAt null; live cardio without work is ignored', () => {
		const counts = getWorkoutCounts([
			makeExercise({ clientKey: null }),
			makeExercise({ kind: 'CARDIO', sets: [], clientKey: 'k', durationMin: null }),
		])

		expect(counts).toEqual({ exerciseCount: 1, setCount: 3, cardioMinutes: null, hasCardio: false })
	})

	it('cardio is never an exercise or a set', () => {
		const counts = getWorkoutCounts([
			makeExercise({ kind: 'CARDIO', sets: [], clientKey: 'k', durationMin: 10 }),
		])

		expect(counts).toEqual({ exerciseCount: 0, setCount: 0, cardioMinutes: 10, hasCardio: true })
	})
})
