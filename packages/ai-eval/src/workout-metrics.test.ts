import type { FoodParseDecision, LogWorkoutInput } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import type { ExpectedWorkout } from './cases/case.types.js'
import type { LoggedWorkout } from './eval.types.js'
import { isWorkoutsCorrect } from './workout-metrics.js'
import { getLoggedWorkouts } from './workout-result.js'

const bench = (overrides: Partial<LoggedWorkout['exercises'][number]> = {}) => ({
	name: 'Жим лежачи',
	kind: 'STRENGTH' as const,
	exerciseRef: null,
	sets: 3,
	warmupSets: 0,
	maxWeightKg: 80,
	reps: 8,
	durationMin: null,
	distanceKm: null,
	...overrides,
})

const run = {
	name: 'Біг',
	kind: 'CARDIO' as const,
	exerciseRef: null,
	sets: 0,
	warmupSets: 0,
	maxWeightKg: null,
	reps: null,
	durationMin: 31,
	distanceKm: 5,
}

const workout = (overrides: Partial<LoggedWorkout> = {}): LoggedWorkout => ({
	place: null,
	durationMin: null,
	kcalBurned: null,
	replaceRef: null,
	exercises: [bench()],
	...overrides,
})

const expected = (overrides: Partial<ExpectedWorkout> = {}): ExpectedWorkout => ({
	exercises: [{ nameIncludes: 'жим', sets: 3, weightKg: 80, reps: 8 }],
	...overrides,
})

describe('isWorkoutsCorrect', () => {
	it('accepts exactly the expected workout', () => {
		expect(isWorkoutsCorrect([expected()], [workout()])).toBe(true)
	})

	it('needs the same number of workouts, and [] means none', () => {
		expect(isWorkoutsCorrect([], [])).toBe(true)
		expect(isWorkoutsCorrect([], [workout()])).toBe(false)
		expect(isWorkoutsCorrect([expected()], [workout(), workout()])).toBe(false)
	})

	it('rejects a wrong weight, set count or an extra exercise, but not another order', () => {
		expect(
			isWorkoutsCorrect([expected()], [workout({ exercises: [bench({ maxWeightKg: 75 })] })]),
		).toBe(false)
		expect(isWorkoutsCorrect([expected()], [workout({ exercises: [bench({ sets: 4 })] })])).toBe(
			false,
		)
		expect(isWorkoutsCorrect([expected()], [workout({ exercises: [bench(), run] })])).toBe(false)
		const two = expected({
			exercises: [
				{ nameIncludes: 'біг', distanceKm: 5 },
				{ nameIncludes: 'жим', sets: 3 },
			],
		})
		expect(isWorkoutsCorrect([two], [workout({ exercises: [bench(), run] })])).toBe(true)
	})

	it('checks place, burned kcal (null = none may be set) and replaceRef when given', () => {
		expect(isWorkoutsCorrect([expected({ place: 'GYM' })], [workout({ place: 'HOME' })])).toBe(
			false,
		)
		expect(
			isWorkoutsCorrect([expected({ kcalBurned: null })], [workout({ kcalBurned: 300 })]),
		).toBe(false)
		expect(isWorkoutsCorrect([expected({ kcalBurned: 400 })], [workout({ kcalBurned: 400 })])).toBe(
			true,
		)
		expect(
			isWorkoutsCorrect([expected({ replaceRef: 'w1' })], [workout({ replaceRef: null })]),
		).toBe(false)
	})

	it('checks the exerciseRef: null means a new exercise', () => {
		const known = expected({
			exercises: [{ nameIncludes: 'жим', exerciseRef: 'x1' }],
		})

		expect(
			isWorkoutsCorrect([known], [workout({ exercises: [bench({ exerciseRef: 'x1' })] })]),
		).toBe(true)
		expect(isWorkoutsCorrect([known], [workout()])).toBe(false)
	})

	it('matches the distance within 50 m', () => {
		const want = expected({ exercises: [{ nameIncludes: 'біг', distanceKm: 5 }] })

		expect(
			isWorkoutsCorrect([want], [workout({ exercises: [{ ...run, distanceKm: 5.03 }] })]),
		).toBe(true)
		expect(isWorkoutsCorrect([want], [workout({ exercises: [{ ...run, distanceKm: 4.5 }] })])).toBe(
			false,
		)
	})
})

describe('getLoggedWorkouts', () => {
	const input: LogWorkoutInput = {
		date: null,
		place: 'GYM',
		durationMin: null,
		kcalBurned: null,
		replaceRef: null,
		appendRef: null,
		finish: false,
		exerciseGroups: [],
		reply: 'ок',
		exercises: [
			{
				name: 'Жим лежачи',
				exerciseRef: null,
				kind: 'STRENGTH',
				muscleGroup: null,
				durationMin: null,
				distanceKm: null,
				sets: [
					{ reps: 10, weightKg: 40, count: 1, isWarmup: true },
					{ reps: 8, weightKg: 80, count: 2, isWarmup: false },
					{ reps: 6, weightKg: 85, count: 1, isWarmup: false },
				],
			},
		],
	}

	it('expands the groups and takes the heaviest working weight, not the warm-up', () => {
		const decision = { kind: 'workout', workouts: [input] } as FoodParseDecision

		const [logged] = getLoggedWorkouts(decision)

		expect(logged?.exercises[0]).toMatchObject({
			sets: 4,
			warmupSets: 1,
			maxWeightKg: 85,
			reps: 8,
		})
	})

	it('reads the trainings of a food log too, and nothing from other decisions', () => {
		const withFood = { kind: 'log', workouts: [input] } as unknown as FoodParseDecision
		const reply = { kind: 'reply', text: 'ок' } as unknown as FoodParseDecision

		expect(getLoggedWorkouts(withFood)).toHaveLength(1)
		expect(getLoggedWorkouts(reply)).toEqual([])
	})
})
