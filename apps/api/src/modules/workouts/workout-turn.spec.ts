import { describe, expect, it } from 'vitest'

import { expandSets, toDistanceM } from './workout-turn'

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
