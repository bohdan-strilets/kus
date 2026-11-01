import { describe, expect, it } from 'vitest'

import { buildWorkoutStats } from './workout-stats'
import { EX_PULLUP, EX_RUN, makeEntry, makeSet, makeWorkout } from './workout-stats.test-utils'
import type { StatsEntryRow, StatsWorkoutRow } from './workout-stats.types'

const TODAY = '2026-10-28'

const build = (
	workouts: StatsWorkoutRow[],
	entries: StatsEntryRow[],
	allTime: StatsEntryRow[] = entries,
	period: 'week' | 'month' | 'quarter' = 'week',
) =>
	buildWorkoutStats({
		period,
		today: TODAY,
		workouts,
		entries,
		allTimeStrengthEntries: allTime.filter((entry) => entry.kind === 'STRENGTH'),
	})

const cardio = (overrides: Partial<StatsEntryRow> = {}) =>
	makeEntry({ exerciseId: EX_RUN, name: 'Біг', kind: 'CARDIO', sets: [], ...overrides })

describe('buildWorkoutStats overview', () => {
	it('is zeros and empty arrays for an empty period', () => {
		const stats = build([], [])
		expect(stats.overview).toMatchObject({
			workoutCount: 0,
			workoutCountPrev: 0,
			exerciseCount: 0,
			setCount: 0,
			durationMin: 0,
			avgDurationMin: null,
			hasEstimatedDuration: false,
			kcal: { total: null, workoutsWithKcal: 0, workoutCount: 0 },
			groups: [],
		})
		expect(stats.overview.buckets).toHaveLength(7)
		expect(stats.exercises).toEqual([])
		expect(stats.cardio).toMatchObject({
			sessionCount: 0,
			durationMin: 0,
			distanceM: 0,
			byExercise: [],
		})
	})

	it('does not count warm-up sets or cardio in sets and exercises', () => {
		const stats = build(
			[makeWorkout()],
			[
				makeEntry({ sets: [makeSet({ isWarmup: true }), makeSet(), makeSet()] }),
				cardio({ durationMin: 30, sets: [makeSet()] }),
			],
		)
		expect(stats.overview.setCount).toBe(2)
		expect(stats.overview.exerciseCount).toBe(1)
	})

	it('counts OTHER only in workouts and duration', () => {
		const stats = build(
			[makeWorkout({ durationMin: 45 })],
			[makeEntry({ kind: 'OTHER', exerciseId: null, name: 'Йога', sets: [makeSet()] })],
		)
		expect(stats.overview).toMatchObject({
			workoutCount: 1,
			durationMin: 45,
			setCount: 0,
			exerciseCount: 0,
		})
		expect(stats.overview.groups).toEqual([])
		expect(stats.cardio.sessionCount).toBe(0)
	})

	it('counts the same exercise once, by name when it has no id', () => {
		const stats = build(
			[makeWorkout(), makeWorkout({ id: 'w2', localDate: '2026-10-27' })],
			[
				makeEntry({ exerciseId: null, name: 'Присідання.' }),
				makeEntry({
					workoutId: 'w2',
					workoutLocalDate: '2026-10-27',
					exerciseId: null,
					name: ' присідання',
				}),
			],
		)
		expect(stats.overview.exerciseCount).toBe(1)
		expect(stats.exercises).toEqual([])
	})

	it('groups working sets in the fixed order with «Інше» last and drops empty ones', () => {
		const stats = build(
			[makeWorkout()],
			[
				makeEntry({ exercise: { muscleGroup: 'CHEST' }, sets: [makeSet(), makeSet()] }),
				makeEntry({ exerciseId: null, name: 'Щось дивне', exercise: null }),
				makeEntry({
					name: 'Тяга',
					exercise: { muscleGroup: 'BACK' },
					sets: [makeSet(), makeSet({ isWarmup: true })],
				}),
				makeEntry({
					name: 'Ноги',
					exercise: { muscleGroup: 'LEGS' },
					sets: [makeSet({ isWarmup: true })],
				}),
			],
		)
		expect(stats.overview.groups).toEqual([
			{ muscleGroup: 'CHEST', setCount: 2 },
			{ muscleGroup: 'BACK', setCount: 1 },
			{ muscleGroup: null, setCount: 1 },
		])
	})

	it('counts workouts of the previous period at the same offset', () => {
		const stats = build(
			[
				makeWorkout(),
				makeWorkout({ id: 'p1', localDate: '2026-10-20' }),
				makeWorkout({ id: 'p2', localDate: '2026-10-21' }),
				makeWorkout({ id: 'p3', localDate: '2026-10-22' }),
			],
			[],
		)
		expect(stats.overview.workoutCount).toBe(1)
		expect(stats.overview.workoutCountPrev).toBe(2)
	})

	it('puts workouts and sets in their buckets', () => {
		const stats = build(
			[makeWorkout(), makeWorkout({ id: 'w2', localDate: '2026-10-26' })],
			[
				makeEntry({ sets: [makeSet(), makeSet()] }),
				cardio({ workoutId: 'w2', workoutLocalDate: '2026-10-26', durationMin: 20 }),
			],
		)
		expect(stats.overview.buckets[0]).toMatchObject({ workoutCount: 1, setCount: 0, cardioMin: 20 })
		expect(stats.overview.buckets[2]).toMatchObject({ workoutCount: 1, setCount: 2, cardioMin: 0 })
	})
})

describe('buildWorkoutStats duration and kcal', () => {
	it('sums named durations and averages them', () => {
		const stats = build(
			[makeWorkout({ durationMin: 60 }), makeWorkout({ id: 'w2', durationMin: 31 })],
			[],
		)
		expect(stats.overview).toMatchObject({
			durationMin: 91,
			avgDurationMin: 46,
			hasEstimatedDuration: false,
		})
	})

	it('falls back to the estimate and marks it', () => {
		const stats = build(
			[
				makeWorkout({
					durationMin: null,
					finishedAt: new Date('2026-10-28T18:00:00Z'),
					finishedMessageId: 'm2',
					entries: [{ performedAt: new Date('2026-10-28T17:00:00Z'), sourceMessageId: 'm1' }],
				}),
				makeWorkout({ id: 'w2', durationMin: 30 }),
			],
			[],
		)
		expect(stats.overview).toMatchObject({
			durationMin: 90,
			avgDurationMin: 45,
			hasEstimatedDuration: true,
		})
	})

	it('has no average when no workout has a duration', () => {
		const stats = build([makeWorkout({ durationMin: null })], [])
		expect(stats.overview).toMatchObject({ durationMin: 0, avgDurationMin: null })
	})

	it('averages workouts per week over the days gone, at least one week', () => {
		const sixInMonth = Array.from({ length: 6 }, (_, index) =>
			makeWorkout({ id: `w${index}`, localDate: '2026-10-05' }),
		)
		expect(build(sixInMonth, [], [], 'month').overview.avgPerWeek).toBe(1.5)
		expect(build([makeWorkout({})], [], [], 'week').overview.avgPerWeek).toBe(1)
		expect(build([], [], [], 'month').overview.avgPerWeek).toBeNull()
	})

	it('counts only kcal the person named or a device showed', () => {
		const stats = build(
			[
				makeWorkout({ kcalBurned: 300, kcalSource: 'MANUAL' }),
				makeWorkout({ id: 'w2', kcalBurned: 200, kcalSource: 'DEVICE' }),
				makeWorkout({ id: 'w3', kcalBurned: 999, kcalSource: 'AI_ESTIMATE' }),
				makeWorkout({ id: 'w4' }),
			],
			[],
		)
		expect(stats.overview.kcal).toEqual({ total: 500, workoutsWithKcal: 2, workoutCount: 4 })
	})
})

describe('buildWorkoutStats cardio', () => {
	it('sums minutes and distance, groups by exercise and sorts by minutes', () => {
		const stats = build(
			[makeWorkout(), makeWorkout({ id: 'w2', localDate: '2026-10-27' })],
			[
				cardio({ durationMin: 30, distanceM: 5000 }),
				cardio({
					workoutId: 'w2',
					workoutLocalDate: '2026-10-27',
					durationMin: 20,
					distanceM: 3000,
				}),
				cardio({ exerciseId: EX_PULLUP, name: 'Орбітрек', durationMin: 60 }),
				cardio({ exerciseId: null, name: 'Ходьба', durationMin: 10, distanceM: 800 }),
			],
		)
		expect(stats.cardio).toMatchObject({ sessionCount: 2, durationMin: 120, distanceM: 8800 })
		expect(stats.cardio.byExercise).toEqual([
			{
				exerciseId: EX_PULLUP,
				name: 'Орбітрек',
				sessionCount: 1,
				durationMin: 60,
				distanceM: null,
			},
			{ exerciseId: EX_RUN, name: 'Біг', sessionCount: 2, durationMin: 50, distanceM: 8000 },
		])
		expect(stats.cardio.buckets).toHaveLength(7)
		expect(stats.cardio.buckets[2]).toEqual({ from: '2026-10-28', to: '2026-10-28', minutes: 100 })
	})
})

describe('buildWorkoutStats exercises', () => {
	it('takes best from all time and the trend from the period', () => {
		const old = makeEntry({
			workoutId: 'old',
			workoutLocalDate: '2026-08-01',
			sets: [makeSet({ weightKg: 100, reps: 3 })],
		})
		const stats = build(
			[makeWorkout(), makeWorkout({ id: 'w2', localDate: '2026-10-27' })],
			[
				makeEntry({
					workoutId: 'w2',
					workoutLocalDate: '2026-10-27',
					sets: [makeSet({ weightKg: 60 })],
				}),
				makeEntry({
					sets: [makeSet({ weightKg: 70, reps: 6 }), makeSet({ weightKg: 40, isWarmup: true })],
				}),
			],
			[old],
		)
		expect(stats.exercises).toHaveLength(1)
		expect(stats.exercises[0]).toMatchObject({
			muscleGroup: 'CHEST',
			isBodyweight: false,
			sessionCount: 2,
			setCount: 2,
			lastLocalDate: '2026-10-28',
			best: { weightKg: 100, reps: 3, localDate: '2026-08-01' },
			trend: [60, 70],
			change: 10,
		})
	})

	it('has change null with one point and treats weight 0 as bodyweight', () => {
		const stats = build(
			[makeWorkout()],
			[
				makeEntry({
					exerciseId: EX_PULLUP,
					name: 'Підтягування',
					sets: [makeSet({ weightKg: 0, reps: 8 }), makeSet({ weightKg: null, reps: 12 })],
				}),
			],
		)
		expect(stats.exercises[0]).toMatchObject({
			isBodyweight: true,
			best: { weightKg: null, reps: 12, localDate: '2026-10-28' },
			trend: [12],
			change: null,
		})
	})

	it('sorts by last date desc, then by name', () => {
		const stats = build(
			[makeWorkout(), makeWorkout({ id: 'w2', localDate: '2026-10-27' })],
			[
				makeEntry({ exerciseId: EX_RUN, name: 'Яблучко' }),
				makeEntry({ exerciseId: EX_PULLUP, name: 'Альфа' }),
				makeEntry({ workoutId: 'w2', workoutLocalDate: '2026-10-27', name: 'Жим' }),
			],
		)
		expect(stats.exercises.map((exercise) => exercise.name)).toEqual(['Альфа', 'Яблучко', 'Жим'])
	})
})

describe('buildWorkoutStats range', () => {
	it('returns the full period and ignores rows outside it', () => {
		const stats = build(
			[makeWorkout({ localDate: '2026-09-01' })],
			[makeEntry({ workoutLocalDate: '2026-09-01' })],
			[],
			'month',
		)
		expect(stats).toMatchObject({ from: '2026-10-01', to: '2026-10-31' })
		expect(stats.overview.workoutCount).toBe(0)
		expect(stats.overview.workoutCountPrev).toBe(1)
		expect(stats.overview.setCount).toBe(0)
	})
})
