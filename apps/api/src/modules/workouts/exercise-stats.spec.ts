import { describe, expect, it } from 'vitest'

import { buildExerciseStats, EXERCISE_HISTORY_LIMIT } from './exercise-stats'
import { EX_BENCH, makeEntry, makeSet } from './workout-stats.test-utils'
import type { StatsEntryRow } from './workout-stats.types'

const BENCH = { id: EX_BENCH, name: 'Жим лежачи', kind: 'STRENGTH', muscleGroup: 'CHEST' } as const

const build = (entries: StatsEntryRow[], period: 'week' | 'month' | 'quarter' = 'month') =>
	buildExerciseStats({ exercise: BENCH, period, today: '2026-10-28', entries })

const entryOn = (workoutId: string, localDate: string, sets: Parameters<typeof makeSet>[0][]) =>
	makeEntry({ workoutId, workoutLocalDate: localDate, sets: sets.map((set) => makeSet(set)) })

describe('buildExerciseStats weighted', () => {
	const entries = [
		entryOn('a', '2026-08-10', [{ weightKg: 80, reps: 5 }]),
		entryOn('b', '2026-10-05', [
			{ weightKg: 70, reps: 8 },
			{ weightKg: 70, reps: 6 },
		]),
		entryOn('c', '2026-10-20', [
			{ weightKg: 40, reps: 15, isWarmup: true },
			{ weightKg: 67.5, reps: 10 },
			{ weightKg: 72.5, reps: 4 },
		]),
	]

	it('takes best from all time and points from the period only', () => {
		const stats = build(entries)
		expect([stats.from, stats.to]).toEqual(['2026-10-01', '2026-10-31'])
		expect(stats.period).toBe('month')
		expect(stats.exercise.isBodyweight).toBe(false)
		expect(stats.best.topSet).toEqual({ weightKg: 80, reps: 5, localDate: '2026-08-10' })
		expect(stats.best.maxReps).toEqual({ weightKg: 80, reps: 5, localDate: '2026-08-10' })
		expect(stats.best.maxSessionReps).toBeNull()
		expect(stats.points).toEqual([
			{ localDate: '2026-10-05', workoutId: 'b', topWeightKg: 70, maxReps: 8 },
			{ localDate: '2026-10-20', workoutId: 'c', topWeightKg: 72.5, maxReps: 4 },
		])
		expect(stats.change).toBe(2.5)
		expect(stats.changeReps).toBe(-4)
	})

	it('gives the most reps at the heaviest weight, not the most reps overall', () => {
		const stats = build([
			entryOn('a', '2026-10-01', [{ weightKg: 60, reps: 20 }]),
			entryOn('b', '2026-10-10', [{ weightKg: 70, reps: 6 }]),
			entryOn('c', '2026-10-15', [{ weightKg: 70, reps: 8 }]),
		])
		expect(stats.best.maxReps).toEqual({ weightKg: 70, reps: 8, localDate: '2026-10-15' })
		expect(stats.best.topSet).toEqual({ weightKg: 70, reps: 8, localDate: '2026-10-10' })
	})

	it('has change null with one point and no best without working sets', () => {
		const one = build(entries.slice(2))
		expect(one.points).toHaveLength(1)
		expect(one.change).toBeNull()
		expect(one.changeReps).toBeNull()
		const warmupOnly = build([makeEntry({ sets: [makeSet({ isWarmup: true })] })])
		expect(warmupOnly.best.topSet).toBeNull()
		expect(warmupOnly.points).toEqual([])
	})

	it('avoids float noise in the change', () => {
		const stats = build([
			entryOn('a', '2026-10-01', [{ weightKg: 67.1 }]),
			entryOn('b', '2026-10-10', [{ weightKg: 67.4 }]),
		])
		expect(stats.change).toBe(0.3)
	})
})

describe('buildExerciseStats bodyweight', () => {
	it('uses reps for best, points and the session total', () => {
		const stats = build([
			entryOn('a', '2026-08-01', [
				{ weightKg: null, reps: 10 },
				{ weightKg: null, reps: 10 },
				{ weightKg: null, reps: 10 },
			]),
			entryOn('b', '2026-10-05', [
				{ weightKg: null, reps: 8 },
				{ weightKg: null, reps: 6 },
			]),
			entryOn('c', '2026-10-12', [
				{ weightKg: 0, reps: 9 },
				{ weightKg: 0, reps: 7 },
			]),
		])
		expect(stats.exercise.isBodyweight).toBe(true)
		expect(stats.best.topSet).toEqual({ weightKg: null, reps: 10, localDate: '2026-08-01' })
		expect(stats.best.maxReps).toEqual({ weightKg: null, reps: 10, localDate: '2026-08-01' })
		expect(stats.best.maxSessionReps).toEqual({ reps: 30, localDate: '2026-08-01' })
		expect(stats.points.map((point) => [point.topWeightKg, point.maxReps])).toEqual([
			[null, 8],
			[null, 9],
		])
		expect(stats.change).toBe(1)
		expect(stats.changeReps).toBe(1)
	})
})

describe('buildExerciseStats history record', () => {
	const records = (entries: StatsEntryRow[]) =>
		build(entries).history.map((item) => [item.workoutId, item.record])

	it('marks the first weighted workout that reached the max weight', () => {
		expect(
			records([
				entryOn('a', '2026-09-01', [{ weightKg: 60, reps: 8 }]),
				entryOn('b', '2026-09-10', [{ weightKg: 80, reps: 5 }]),
				entryOn('c', '2026-09-20', [{ weightKg: 80, reps: 8 }]),
			]),
		).toEqual([
			['c', null],
			['b', 'WEIGHT'],
			['a', null],
		])
	})

	it('marks the first max-reps workout of a bodyweight exercise with REPS', () => {
		expect(
			records([
				entryOn('a', '2026-09-01', [{ weightKg: null, reps: 8 }]),
				entryOn('b', '2026-09-10', [{ weightKg: null, reps: 12 }]),
				entryOn('c', '2026-09-20', [{ weightKg: null, reps: 12 }]),
			]),
		).toEqual([
			['c', null],
			['b', 'REPS'],
			['a', null],
		])
	})

	it('marks nothing when the record is older than the last 20 workouts', () => {
		const old = entryOn('old', '2026-01-01', [{ weightKg: 100, reps: 3 }])
		const recent = Array.from({ length: EXERCISE_HISTORY_LIMIT }, (_, index) =>
			entryOn(
				`w${String(index).padStart(2, '0')}`,
				`2026-09-${String(index + 1).padStart(2, '0')}`,
				[{ weightKg: 50, reps: 5 }],
			),
		)
		const { history } = build([old, ...recent])
		expect(history).toHaveLength(EXERCISE_HISTORY_LIMIT)
		expect(history.every((item) => item.record === null)).toBe(true)
	})
})

describe('buildExerciseStats history', () => {
	it('is the last 20 workouts, newest first', () => {
		const entries = Array.from({ length: 25 }, (_, index) =>
			makeEntry({
				workoutId: `w${String(index).padStart(2, '0')}`,
				workoutLocalDate: `2026-09-${String(index + 1).padStart(2, '0')}`,
			}),
		)
		const { history } = build(entries)
		expect(history).toHaveLength(EXERCISE_HISTORY_LIMIT)
		expect(history[0]?.localDate).toBe('2026-09-25')
		expect(history[19]?.localDate).toBe('2026-09-06')
	})

	it('keeps warm-ups and merges two entries of one workout in position order', () => {
		const { history } = build([
			makeEntry({ position: 2, sets: [makeSet({ reps: 3 })] }),
			makeEntry({
				position: 0,
				sets: [makeSet({ reps: 15, isWarmup: true }), makeSet({ reps: 8 })],
			}),
		])
		expect(history).toHaveLength(1)
		expect(history[0]?.sets.map((set) => [set.reps, set.isWarmup])).toEqual([
			[15, true],
			[8, false],
			[3, false],
		])
	})
})
