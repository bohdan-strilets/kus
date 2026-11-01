import { templateExerciseTargetSchema } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import {
	adjustDistance,
	adjustDuration,
	adjustRepsMax,
	adjustRepsMin,
	adjustSets,
	adjustWeight,
	setDistanceKm,
	setRepsMax,
	setRepsMin,
	setWeight,
} from './adjust-target'
import { makeTarget } from './fixtures'

describe('adjustSets', () => {
	it('steps by one inside the limits', () => {
		expect(adjustSets(makeTarget({ sets: 3 }), 1).sets).toBe(4)
		expect(adjustSets(makeTarget({ sets: 1 }), -1).sets).toBe(1)
		expect(adjustSets(makeTarget({ sets: 10 }), 1).sets).toBe(10)
	})

	it('starts an empty field at three and never clears a set one', () => {
		expect(adjustSets(makeTarget({ sets: null }), 1).sets).toBe(3)
		expect(adjustSets(makeTarget({ sets: null }), -1).sets).toBeNull()
	})
})

describe('reps range', () => {
	it('pushes «до» along when «від» passes it', () => {
		const next = adjustRepsMin(makeTarget({ repsMin: 12, repsMax: 12 }), 1)

		expect([next.repsMin, next.repsMax]).toEqual([13, 13])
	})

	it('pulls «від» along when «до» goes under it', () => {
		const next = adjustRepsMax(makeTarget({ repsMin: 8, repsMax: 8 }), -1)

		expect([next.repsMin, next.repsMax]).toEqual([7, 7])
	})

	it('keeps the range valid by the shared schema', () => {
		let target = makeTarget({ repsMin: 8, repsMax: 9 })
		for (let step = 0; step < 6; step += 1) target = adjustRepsMin(target, 1)
		for (let step = 0; step < 30; step += 1) target = adjustRepsMax(target, -1)

		expect(templateExerciseTargetSchema.safeParse(target).success).toBe(true)
	})
})

describe('adjustWeight', () => {
	it('steps by the progress step', () => {
		expect(adjustWeight(makeTarget({ weightKg: 50, progressStepKg: 2.5 }), 1).weightKg).toBe(52.5)
		expect(adjustWeight(makeTarget({ weightKg: 50, progressStepKg: 5 }), -1).weightKg).toBe(45)
		expect(adjustWeight(makeTarget({ weightKg: 20, progressStepKg: 1 }), 1).weightKg).toBe(21)
	})

	it('starts no weight at one step and brings the default progress step', () => {
		const next = adjustWeight(makeTarget({ weightKg: null, progressStepKg: null }), 1)

		expect([next.weightKg, next.progressStepKg]).toEqual([2.5, 2.5])
	})

	it('reads the 0 of a bodyweight plan as no weight', () => {
		expect(adjustWeight(makeTarget({ weightKg: 0, progressStepKg: null }), 1).weightKg).toBe(2.5)
	})

	it('clears the weight and the step when it goes down from the first step', () => {
		const next = adjustWeight(makeTarget({ weightKg: 2.5, progressStepKg: 2.5 }), -1)

		expect([next.weightKg, next.progressStepKg]).toEqual([null, null])
	})

	it('does not drift on decimal steps and stops at the limit', () => {
		let target = makeTarget({ weightKg: 0, progressStepKg: 2.5 })
		for (let step = 0; step < 3; step += 1) target = adjustWeight(target, 1)

		expect(target.weightKg).toBe(7.5)
		expect(adjustWeight(makeTarget({ weightKg: 500, progressStepKg: 5 }), 1).weightKg).toBe(500)
	})
})

describe('cardio steppers', () => {
	it('steps minutes by five, starting at ten', () => {
		expect(adjustDuration(makeTarget({ durationMin: null }), 1).durationMin).toBe(10)
		expect(adjustDuration(makeTarget({ durationMin: 10 }), 1).durationMin).toBe(15)
		expect(adjustDuration(makeTarget({ durationMin: 3 }), -1).durationMin).toBe(1)
	})

	it('steps the distance by half a kilometre and clears it going down from the first step', () => {
		expect(adjustDistance(makeTarget({ distanceM: null }), 1).distanceM).toBe(500)
		expect(adjustDistance(makeTarget({ distanceM: 3000 }), 1).distanceM).toBe(3500)
		expect(adjustDistance(makeTarget({ distanceM: 500 }), -1).distanceM).toBeNull()
	})
})

describe('typed-in values', () => {
	it('drags the other end of the reps range along', () => {
		const target = makeTarget({ repsMin: 8, repsMax: 12 })

		expect(setRepsMin(target, 15)).toMatchObject({ repsMin: 15, repsMax: 15 })
		expect(setRepsMax(target, 6)).toMatchObject({ repsMin: 6, repsMax: 6 })
		expect(setRepsMax(target, 20)).toMatchObject({ repsMin: 8, repsMax: 20 })
	})

	it('brings the progress step with a typed weight, and 0 clears both', () => {
		const withWeight = setWeight(makeTarget({ weightKg: null, progressStepKg: null }), 62.5)

		expect(withWeight.weightKg).toBe(62.5)
		expect(withWeight.progressStepKg).not.toBeNull()
		expect(setWeight(withWeight, 0)).toMatchObject({ weightKg: null, progressStepKg: null })
	})

	it('turns typed kilometres into metres', () => {
		expect(setDistanceKm(makeTarget(), 5.2).distanceM).toBe(5200)
	})
})
