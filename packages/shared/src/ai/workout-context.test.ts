import { describe, expect, it } from 'vitest'

import { formatContext, type FoodParseContext } from './context.js'
import { formatExercise, formatSets, formatWorkout } from './workout-context.js'

const set = (reps: number | null, weightKg: number | null, isWarmup = false) => ({
	reps,
	weightKg,
	isWarmup,
})

describe('formatSets', () => {
	it('groups equal consecutive sets', () => {
		expect(formatSets([set(8, 80), set(8, 80), set(8, 80), set(6, 80)])).toBe(
			'3×8 at 80 kg, 1×6 at 80 kg',
		)
	})

	it('marks a warm-up and handles bodyweight and unknown reps', () => {
		expect(formatSets([set(10, 40, true), set(8, 80)])).toBe('warm-up 1×10 at 40 kg, 1×8 at 80 kg')
		expect(formatSets([set(15, null), set(15, null)])).toBe('2×15')
		expect(formatSets([set(null, 60), set(null, 60)])).toBe('2 sets at 60 kg')
	})
})

describe('formatWorkout', () => {
	const gym = {
		ref: 'w1',
		place: 'GYM' as const,
		time: '18:30',
		durationMin: 55,
		kcalBurned: 320,
		exercises: [
			{
				name: 'Жим лежачи',
				sets: [set(8, 80), set(8, 80), set(8, 80)],
				durationMin: null,
				distanceKm: null,
			},
			{ name: 'Бігова доріжка', sets: [], durationMin: 20, distanceKm: 3 },
		],
	}

	it('lists the exercises and the burned kcal the user named', () => {
		expect(formatWorkout(gym)).toBe(
			'- w1 GYM 18:30, 55 min: "Жим лежачи" 3×8 at 80 kg; "Бігова доріжка" 20 min, 3.0 km. Burned: 320 kcal (said by the user)',
		)
	})

	it('has a comma after the place when there is no time, and no Burned line without a number', () => {
		const run = {
			...gym,
			ref: 'w2',
			place: 'OUTDOOR' as const,
			time: null,
			durationMin: 31,
			kcalBurned: null,
			exercises: [{ name: 'Біг', sets: [], durationMin: 31, distanceKm: 5 }],
		}

		expect(formatWorkout(run)).toBe('- w2 OUTDOOR, 31 min: "Біг" 31 min, 5.0 km')
	})

	it('leaves out a missing place and duration', () => {
		const bare = { ...gym, place: null, time: null, durationMin: null, kcalBurned: null }

		expect(formatWorkout(bare).startsWith('- w1: ')).toBe(true)
	})
})

describe('formatExercise', () => {
	it('tells the last result with its date', () => {
		expect(
			formatExercise({
				ref: 'x1',
				name: 'Жим лежачи',
				kind: 'STRENGTH',
				last: {
					date: '2026-10-23',
					sets: [set(8, 80), set(8, 80), set(8, 80)],
					durationMin: null,
					distanceKm: null,
				},
			}),
		).toBe('- x1 "Жим лежачи" (STRENGTH): 3×8 at 80 kg on 2026-10-23')
	})

	it('shows a new exercise without a last result', () => {
		expect(formatExercise({ ref: 'x2', name: 'Біг', kind: 'CARDIO', last: null })).toBe(
			'- x2 "Біг" (CARDIO)',
		)
	})
})

describe('formatContext with workouts', () => {
	const base: FoodParseContext = {
		localTime: '2026-10-27 19:40, Tuesday',
		dayTotals: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
		meals: [],
		entries: [],
		deletedEntries: [],
		openClarifications: [],
		goal: null,
		measurements: { today: '2026-10-27', weights: [], waist: null, targetWeightKg: null },
		memory: [],
		history: [],
	}
	const workout = {
		ref: 'w1',
		place: 'GYM' as const,
		time: '18:30',
		durationMin: 55,
		kcalBurned: null,
		exercises: [{ name: 'Жим', sets: [set(8, 80)], durationMin: null, distanceKm: null }],
	}

	it('adds no section without workouts', () => {
		expect(formatContext(base)).not.toContain('workouts')
		expect(formatContext(base)).not.toContain('Exercises')
	})

	it("lists today's workouts, deleted ones under «Deleted today», and the exercises", () => {
		const text = formatContext({
			...base,
			workouts: [workout],
			deletedWorkouts: [{ ...workout, ref: 'w2', time: null }],
			exercises: [{ ref: 'x1', name: 'Жим', kind: 'STRENGTH', last: null }],
		})

		expect(text).toContain(
			"Today's workouts (refs for delete_entry / restore_entry and log_workout.replaceRef):",
		)
		expect(text).toContain('- w1 GYM 18:30, 55 min: "Жим" 1×8 at 80 kg')
		expect(text).toContain('Deleted today (refs for restore_entry):\n- w2 GYM, 55 min:')
		expect(text).toContain(
			'Exercises (refs for exerciseRef; the last result of each):\n- x1 "Жим" (STRENGTH)',
		)
	})
})
