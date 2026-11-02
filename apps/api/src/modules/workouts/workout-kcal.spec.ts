import { formatWorkout } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { estimateWorkoutKcal, type KcalEntry, type KcalSet, type KcalWorkout } from './workout-kcal'
import { STRENGTH_MIN_PER_SET } from './workout-kcal.constants'
import { getCardioMet } from './workout-kcal-met'
import { toWorkoutContext } from './workout-turn'
import { toWorkoutResponse } from './workouts.mapper'
import type { WorkoutWithExercises } from './workouts.repository'

const KG = 80

const set = (overrides: Partial<KcalSet> = {}): KcalSet => ({
	isWarmup: false,
	durationSec: null,
	distanceM: null,
	...overrides,
})

const sets = (count: number, overrides: Partial<KcalSet> = {}): KcalSet[] =>
	Array.from({ length: count }, () => set(overrides))

const strength = (overrides: Partial<KcalEntry> = {}): KcalEntry => ({
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	isBodyweight: null,
	exercise: null,
	durationMin: null,
	distanceM: null,
	kcalBurned: null,
	source: 'MANUAL',
	sets: sets(4),
	...overrides,
})

const cardio = (overrides: Partial<KcalEntry> = {}): KcalEntry => ({
	name: 'Біг',
	kind: 'CARDIO',
	isBodyweight: null,
	exercise: null,
	durationMin: 30,
	distanceM: null,
	kcalBurned: null,
	source: 'MANUAL',
	sets: [],
	...overrides,
})

const workout = (overrides: Partial<KcalWorkout> = {}): KcalWorkout => ({
	durationMin: 60,
	kcalBurned: null,
	kcalSource: null,
	exercises: [strength()],
	...overrides,
})

const estimate = (w: KcalWorkout, bodyWeightKg: number | null = KG) =>
	estimateWorkoutKcal({ workout: w, bodyWeightKg })

describe('estimateWorkoutKcal: strength', () => {
	it('60 min, 80 kg, regular exercises is 200 kcal', () => {
		expect(estimate(workout())).toEqual({ value: 200, source: 'ESTIMATE' })
	})

	it('bodyweight strength (MET 3.8) is 220', () => {
		const w = workout({ exercises: [strength({ name: 'Підтягування', isBodyweight: true })] })
		expect(estimate(w)).toEqual({ value: 220, source: 'ESTIMATE' })
	})

	it('weights the MET by working sets of bodyweight and regular entries', () => {
		const w = workout({
			exercises: [
				strength({ sets: sets(2), isBodyweight: true }),
				strength({ sets: sets(2), isBodyweight: false }),
			],
		})
		// MET 3.65 -> 2.65 x 80 = 212
		expect(estimate(w)?.value).toBe(210)
	})

	it('takes the time from the working sets when the duration is unknown, warmups excluded', () => {
		const w = workout({
			durationMin: null,
			exercises: [strength({ sets: [...sets(8), ...sets(2, { isWarmup: true })] })],
		})
		const minutes = 8 * STRENGTH_MIN_PER_SET
		const expected = Math.round((2.5 * KG * (minutes / 60)) / 10) * 10
		expect(expected).toBe(60)
		expect(estimate(w)).toEqual({ value: expected, source: 'ESTIMATE' })
	})

	it('has nothing to estimate without duration and without working sets', () => {
		const w = workout({
			durationMin: null,
			exercises: [strength({ sets: sets(3, { isWarmup: true }) })],
		})
		expect(estimate(w)).toBeNull()
	})

	it('uses the bodyweight flag of the entry, then the dictionary, then the name', () => {
		const value = (entry: Partial<KcalEntry>) =>
			estimate(workout({ exercises: [strength(entry)] }))?.value
		expect(value({ name: 'Підтягування', isBodyweight: false })).toBe(200)
		expect(value({ name: 'Жим лежачи', exercise: { isBodyweight: true } })).toBe(220)
		expect(value({ name: 'Підтягування', exercise: { isBodyweight: false } })).toBe(200)
		expect(value({ name: 'Підтягування' })).toBe(220)
		expect(
			value({ name: 'Жим лежачи', isBodyweight: true, exercise: { isBodyweight: false } }),
		).toBe(220)
	})

	it('rounds to 10 by Math.round: 205 goes up to 210', () => {
		expect(estimate(workout(), 82)).toEqual({ value: 210, source: 'ESTIMATE' })
	})

	it('a result that rounds to 0 is null', () => {
		expect(estimate(workout({ durationMin: 5 }), 10)).toBeNull()
	})
})

describe('estimateWorkoutKcal: named values', () => {
	it.each([
		['DEVICE', 'DEVICE'],
		['MANUAL', 'MANUAL'],
		['AI_ESTIMATE', 'ESTIMATE'],
		[null, 'MANUAL'],
	] as const)(
		'named kcal of source %s is %s, exact and without a body weight',
		(kcalSource, source) => {
			const w = workout({ kcalBurned: 333, kcalSource })
			expect(estimate(w, null)).toEqual({ value: 333, source })
			expect(estimate(w, 0)).toEqual({ value: 333, source })
		},
	)

	it('is null without a body weight and with nothing named', () => {
		expect(estimate(workout(), null)).toBeNull()
		expect(estimate(workout(), 0)).toBeNull()
		expect(estimate(workout(), -5)).toBeNull()
	})

	it('a workout without exercises is null', () => {
		expect(estimate(workout({ exercises: [] }))).toBeNull()
	})
})

describe('estimateWorkoutKcal: cardio', () => {
	it('a run of 30 min at 10 km/h is MET 9.3', () => {
		const w = workout({ exercises: [cardio({ distanceM: 5000 })] })
		// 8.3 x 80 x 0.5 = 332
		expect(estimate(w)).toEqual({ value: 330, source: 'ESTIMATE' })
	})

	it('subtracts the cardio minutes from the strength minutes', () => {
		const w = workout({ exercises: [strength(), cardio({ durationMin: 20, distanceM: 3000 })] })
		// cardio 8.3 x 80 / 3 = 221.3, strength 40 min: 2.5 x 80 x 2/3 = 133.3
		expect(estimate(w)).toEqual({ value: 350, source: 'ESTIMATE' })
	})

	it('never gives the strength part a negative time', () => {
		const w = workout({ durationMin: 20, exercises: [strength(), cardio({ durationMin: 30 })] })
		// the cardio only: run, speed unknown -> MET 8.0 -> 7 x 80 x 0.5
		expect(estimate(w)).toEqual({ value: 280, source: 'ESTIMATE' })
	})

	it('a cardio-only workout has no strength part', () => {
		const w = workout({ durationMin: 60, exercises: [cardio({ durationMin: 30 })] })
		expect(estimate(w)?.value).toBe(280)
	})

	it('uses the cardio entry own named kcal as is and estimates the other part', () => {
		const w = workout({
			exercises: [
				cardio({ name: 'Біг', durationMin: 30, kcalBurned: 100, source: 'DEVICE' }),
				cardio({ name: 'Велосипед', durationMin: 60 }),
			],
		})
		// bike MET 5.0: 4 x 80 x 1 = 320; plus 100
		expect(estimate(w)).toEqual({ value: 420, source: 'ESTIMATE' })
	})

	it('only named cardio parts add up exactly; all DEVICE stays DEVICE, a mix is MANUAL', () => {
		const device = (kcalBurned: number) => cardio({ durationMin: 30, kcalBurned, source: 'DEVICE' })
		expect(estimate(workout({ exercises: [device(101), device(54)] }))).toEqual({
			value: 155,
			source: 'DEVICE',
		})
		const manual = cardio({ durationMin: 30, kcalBurned: 54, source: 'MANUAL' })
		expect(estimate(workout({ exercises: [device(101), manual] }))).toEqual({
			value: 155,
			source: 'MANUAL',
		})
	})

	it('a named cardio kcal is shown even without a body weight', () => {
		const w = workout({ exercises: [cardio({ kcalBurned: 100, source: 'DEVICE' })] })
		expect(estimate(w, null)).toEqual({ value: 100, source: 'DEVICE' })
	})

	it('takes the time from the sum of the interval durations', () => {
		const w = workout({
			exercises: [
				cardio({ name: 'Велотренажер', durationMin: null, sets: sets(3, { durationSec: 600 }) }),
			],
		})
		// 30 min, MET 5.0: 4 x 80 x 0.5
		expect(estimate(w)?.value).toBe(160)
	})

	it.each([
		['Біг', 5000, 280], // 30 min at the 6 min/km pace, speed unknown -> MET 8.0
		['Ходьба', 2000, 90], // 24 min, MET 3.8: 2.8 x 80 x 0.4 = 89.6
		['Велосипед', 10000, 160], // 30 min
		['Гребля', 2000, 50], // 10 min, MET 5.0
	])('%s of %i m without a time gets the default pace', (name, distanceM, value) => {
		const w = workout({ exercises: [cardio({ name, durationMin: null, distanceM })] })
		expect(estimate(w)?.value).toBe(value)
	})

	it('a distance in the sets counts as the distance of the entry', () => {
		const w = workout({
			exercises: [
				cardio({
					name: 'Ходьба',
					durationMin: null,
					sets: [set({ distanceM: 1000 }), set({ distanceM: 1000 })],
				}),
			],
		})
		expect(estimate(w)?.value).toBe(90)
	})

	it('skips a cardio with no time and no distance', () => {
		const w = workout({ exercises: [cardio({ durationMin: null })] })
		expect(estimate(w)).toBeNull()
	})

	it('skips a cardio with a distance but no default pace (swim)', () => {
		const w = workout({
			exercises: [cardio({ name: 'Плавання', durationMin: null, distanceM: 1000 })],
		})
		expect(estimate(w)).toBeNull()
	})

	it('a stairs run is stairs, MET 9.3', () => {
		const w = workout({ exercises: [cardio({ name: 'Біг по сходах' })] })
		expect(estimate(w)?.value).toBe(330)
	})

	it('a treadmill walk uses the treadmill MET', () => {
		const slow = cardio({ name: 'Ходьба по доріжці', durationMin: 60, distanceM: 5000 })
		const fast = cardio({ name: 'Ходьба по доріжці', durationMin: 60, distanceM: 6000 })
		// 2.8 x 80 = 224; 4.8 x 80 = 384
		expect(estimate(workout({ exercises: [slow] }))?.value).toBe(220)
		expect(estimate(workout({ exercises: [fast] }))?.value).toBe(380)
	})
})

describe('getCardioMet', () => {
	const met = (
		type: Parameters<typeof getCardioMet>[0]['type'],
		speedKmh: number | null,
		isTreadmill = false,
	): number => getCardioMet({ type, speedKmh, isTreadmill }).met

	it.each([
		[null, 8.0],
		[8.99, 8.5],
		[9, 9.3],
		[10, 9.3],
		[10.5, 9.3],
		[10.51, 11.0],
		[14, 11.0],
	])('run at %s km/h is MET %s', (speed, value) => {
		expect(met('RUN', speed)).toBe(value)
	})

	it.each([
		[null, false, 3.8],
		[5.5, false, 3.8],
		[5.51, false, 5.5],
		[null, true, 3.8],
		[5.5, true, 3.8],
		[5.51, true, 5.8],
	])('walk at %s km/h (treadmill %s) is MET %s', (speed, isTreadmill, value) => {
		expect(met('WALK', speed, isTreadmill)).toBe(value)
	})

	it.each([
		['BIKE', 5.0],
		['OTHER', 5.0],
		['ROW', 5.0],
		['ELLIPTICAL', 5.0],
		['STAIRS', 9.3],
		['ROPE', 11.0],
		['SWIM', 5.8],
	] as const)('%s is MET %s at any speed', (type, value) => {
		expect(met(type, 3)).toBe(value)
		expect(met(type, null)).toBe(value)
	})

	it('a stationary bike is the code 01216, not the road bike', () => {
		const entry = getCardioMet({ type: 'BIKE', speedKmh: null, isTreadmill: false })
		expect(entry.code).toBe('01216')
		expect(entry.met).not.toBe(6.8)
	})
})

describe('the estimate does not reach the model or the stored fields', () => {
	const row = {
		id: 'w1',
		userId: 'u1',
		localDate: new Date('2026-10-27T00:00:00Z'),
		startedAt: new Date('2026-10-27T17:30:00Z'),
		durationMin: 60,
		place: 'GYM',
		kcalBurned: null,
		kcalSource: null,
		note: null,
		records: null,
		editedAt: null,
		finishedAt: null,
		finishedMessageId: null,
		sourceMessageId: null,
		templateId: null,
		template: null,
		source: 'CHAT',
		createdAt: new Date('2026-10-27T17:30:00Z'),
		updatedAt: new Date('2026-10-27T17:30:00Z'),
		deletedAt: null,
		exercises: [
			{
				id: 'e1',
				name: 'Жим лежачи',
				kind: 'STRENGTH',
				muscleGroup: null,
				position: 0,
				durationMin: null,
				distanceM: null,
				kcalBurned: null,
				source: 'MANUAL',
				performedAt: new Date('2026-10-27T17:30:00Z'),
				exerciseId: null,
				isBodyweight: null,
				exercise: null,
				sets: [
					{
						position: 0,
						reps: 8,
						weightKg: null,
						isWarmup: false,
						durationSec: null,
						distanceM: null,
					},
				],
			},
		],
	} as unknown as WorkoutWithExercises
	const contextOptions = {
		ref: 'w1',
		time: '17:30',
		lastAt: null,
		exerciseRefs: new Map<string, string>(),
	}

	it('the response shows the estimate but keeps kcalBurned null', () => {
		const response = toWorkoutResponse(row, { bodyWeightKg: KG })
		expect(response.kcal).toEqual({ value: 200, source: 'ESTIMATE' })
		expect(response.kcalBurned).toBeNull()
		expect(response.kcalSource).toBeNull()
	})

	it('without a body weight the response has no estimate', () => {
		expect(toWorkoutResponse(row).kcal).toBeNull()
	})

	it('the model context has no kcal for an estimated workout', () => {
		const context = toWorkoutContext(row, contextOptions)
		expect(context.kcalBurned).toBeNull()
		expect(formatWorkout(context)).not.toMatch(/kcal|Burned|200/)
	})

	it('a named kcal still reaches the model as said by the user', () => {
		const named = {
			...row,
			kcalBurned: 320,
			kcalSource: 'MANUAL',
		} as unknown as WorkoutWithExercises
		expect(formatWorkout(toWorkoutContext(named, contextOptions))).toContain(
			'Burned: 320 kcal (said by the user)',
		)
	})
})
