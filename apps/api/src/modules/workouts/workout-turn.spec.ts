import { describe, expect, it } from 'vitest'

import { expandSets, getBodyweightMaxReps, isRecord, toDistanceM } from './workout-turn'

const kg = (value: number) => ({ toNumber: () => value })

describe('getBodyweightMaxReps', () => {
	it('takes the most reps of the working sets when none has weight', () => {
		expect(
			getBodyweightMaxReps([
				{ reps: 10, weightKg: null, isWarmup: false },
				{ reps: 12, weightKg: null, isWarmup: false },
				{ reps: null, weightKg: null, isWarmup: false },
			]),
		).toBe(12)
	})

	it('reads weight 0 as no weight', () => {
		expect(
			getBodyweightMaxReps([
				{ reps: 9, weightKg: kg(0), isWarmup: false },
				{ reps: 11, weightKg: null, isWarmup: false },
			]),
		).toBe(11)
	})

	it('has no REPS result when a working set has weight', () => {
		expect(
			getBodyweightMaxReps([
				{ reps: 15, weightKg: null, isWarmup: false },
				{ reps: 8, weightKg: kg(10), isWarmup: false },
			]),
		).toBeNull()
	})

	it('ignores warm-up sets: their reps never count and their weight does not block', () => {
		expect(
			getBodyweightMaxReps([
				{ reps: 20, weightKg: kg(5), isWarmup: true },
				{ reps: 30, weightKg: null, isWarmup: true },
				{ reps: 10, weightKg: null, isWarmup: false },
			]),
		).toBe(10)
		expect(getBodyweightMaxReps([{ reps: 30, weightKg: null, isWarmup: true }])).toBeNull()
	})

	it('has no result without sets or reps', () => {
		expect(getBodyweightMaxReps([])).toBeNull()
		expect(getBodyweightMaxReps([{ reps: null, weightKg: null, isWarmup: false }])).toBeNull()
	})
})

describe('isRecord', () => {
	it('is a record only above an earlier result: a first one is none', () => {
		expect(isRecord(null, 12)).toBe(false)
		expect(isRecord(10, 12)).toBe(true)
		expect(isRecord(12, 12)).toBe(false)
		expect(isRecord(12, null)).toBe(false)
	})
})

describe('toDistanceM', () => {
	it('rounds kilometres to whole metres', () => {
		expect(toDistanceM(3)).toBe(3000)
		expect(toDistanceM(5.0234)).toBe(5023)
	})

	it('treats no distance, and one too short to be a metre, as none', () => {
		expect(toDistanceM(null)).toBeNull()
		expect(toDistanceM(0.0004)).toBeNull()
	})
})

describe('expandSets', () => {
	it('turns «3×8 80» into three rows with their positions and keeps the warm-up flag', () => {
		const rows = expandSets({
			sets: [
				{ reps: 10, weightKg: 40, count: 1, isWarmup: true },
				{ reps: 8, weightKg: 80, count: 3, isWarmup: false },
			],
		})

		expect(rows.map((row) => [row.position, row.reps, row.weightKg, row.isWarmup])).toEqual([
			[0, 10, 40, true],
			[1, 8, 80, false],
			[2, 8, 80, false],
			[3, 8, 80, false],
		])
	})

	it('has no rows for cardio without sets', () => {
		expect(expandSets({ sets: [] })).toEqual([])
	})
})
