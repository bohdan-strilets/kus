import { describe, expect, it } from 'vitest'

import { createDraftExercise } from './new-exercise'

const source = {
	name: 'Тяга блока',
	exerciseId: null,
	kind: 'STRENGTH' as const,
	muscleGroup: 'BACK' as const,
	lastSets: null,
}

describe('createDraftExercise', () => {
	it('starts a strength exercise at 3 × 8–12 with a rest of 90 s and no weight', () => {
		const { target } = createDraftExercise(source)

		expect(target).toEqual({
			sets: 3,
			repsMin: 8,
			repsMax: 12,
			weightKg: null,
			progressStepKg: null,
			restSec: 90,
			durationMin: null,
			distanceM: null,
		})
	})

	it('takes the heaviest working set of the last time and brings the default step', () => {
		const { target } = createDraftExercise({
			...source,
			lastSets: [
				{ reps: 12, weightKg: 100, isWarmup: true },
				{ reps: 10, weightKg: 50, isWarmup: false },
				{ reps: 8, weightKg: 55, isWarmup: false },
			],
		})

		expect([target.weightKg, target.progressStepKg]).toEqual([55, 2.5])
	})

	it('starts cardio at ten minutes and nothing else', () => {
		const { target } = createDraftExercise({ ...source, kind: 'CARDIO', muscleGroup: null })

		expect(target).toMatchObject({ durationMin: 10, sets: null, restSec: null, weightKg: null })
	})

	it('gives every added row its own key', () => {
		expect(createDraftExercise(source).key).not.toBe(createDraftExercise(source).key)
	})
})
