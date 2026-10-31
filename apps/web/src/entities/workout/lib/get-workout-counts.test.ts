import { describe, expect, it } from 'vitest'

import { makeExercise } from '@/shared/testing'

import { getWorkoutCounts } from './get-workout-counts'

const cardio = (durationMin: number | null) =>
	makeExercise({ kind: 'CARDIO', sets: [], durationMin })

describe('getWorkoutCounts', () => {
	it('counts strength exercises and working sets; warm-ups stay out', () => {
		const warmup = { reps: 10, weightKg: 40, durationSec: null, distanceM: null, isWarmup: true }
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
