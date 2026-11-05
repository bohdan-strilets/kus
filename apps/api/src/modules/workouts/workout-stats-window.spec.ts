import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildWorkoutStats } from './workout-stats'
import { makeEntry, makeSet, makeWorkout } from './workout-stats.test-utils'
import { WorkoutStatsService } from './workout-stats.service'
import type { WorkoutStatsRepository } from './workout-stats.repository'
import type { UsersService } from '../users/users.service'
import type { WorkoutKcalService } from './workout-kcal.service'

// 2026-10-31 is a Saturday: the current week is 26.10–01.11, and 01.11 is outside October
const TODAY = '2026-10-31'
const USER_ID = 'user-1'

const cardio = (overrides = {}) =>
	makeEntry({ kind: 'CARDIO', name: 'Біг', sets: [], durationMin: 30, ...overrides })

describe('buildWorkoutStats: current week past the period end', () => {
	const build = (period: 'month' | 'quarter') =>
		buildWorkoutStats({
			period,
			today: TODAY,
			workouts: [
				makeWorkout({ id: 'in', localDate: '2026-10-30' }),
				makeWorkout({ id: 'out', localDate: '2026-11-01' }),
			],
			entries: [
				makeEntry({ workoutId: 'in', workoutLocalDate: '2026-10-30', sets: [makeSet()] }),
				makeEntry({
					workoutId: 'out',
					workoutLocalDate: '2026-11-01',
					sets: [makeSet(), makeSet()],
				}),
				cardio({ workoutId: 'in', workoutLocalDate: '2026-10-30' }),
				cardio({ workoutId: 'out', workoutLocalDate: '2026-11-01', durationMin: 20 }),
			],
			allTimeStrengthEntries: [],
		})

	it('counts 01.11 in the last bar but not in the October totals', () => {
		const { overview } = build('month')
		expect(overview.buckets.at(-1)).toMatchObject({
			from: '2026-10-26',
			to: '2026-11-01',
			workoutCount: 2,
			setCount: 3,
			cardioMin: 50,
		})
		expect(overview.workoutCount).toBe(1)
		expect(overview.setCount).toBe(1)
	})

	it('cardio buckets are the same Monday weeks, 01.11 in the last, totals without it', () => {
		const { cardio: stats } = build('month')
		expect(stats.buckets.at(-1)).toEqual({
			from: '2026-10-26',
			to: '2026-11-01',
			isFuture: false,
			minutes: 50,
		})
		expect(stats.buckets[0]?.from).toBe('2026-09-28')
		expect(stats.buckets.every((bucket) => !bucket.isFuture)).toBe(true)
		expect(stats.durationMin).toBe(30)
		expect(stats.sessionCount).toBe(1)
	})

	it('the quarter works the same way', () => {
		const { overview } = build('quarter')
		expect(overview.buckets.at(-1)).toMatchObject({ to: '2026-11-01', workoutCount: 2 })
		expect(overview.workoutCount).toBe(1)
	})

	it('cardio of the week period marks days after today as future', () => {
		const stats = buildWorkoutStats({
			period: 'week',
			today: '2026-10-28',
			workouts: [],
			entries: [],
			allTimeStrengthEntries: [],
		})
		expect(stats.cardio.buckets.map((bucket) => bucket.isFuture)).toEqual([
			false,
			false,
			false,
			true,
			true,
			true,
			true,
		])
	})
})

describe('WorkoutStatsService.getStats query window', () => {
	const findWorkoutsInRange = vi.fn()
	const findEntriesInRange = vi.fn()
	const statsRepository = {
		findWorkoutsInRange,
		findEntriesInRange,
		findStrengthEntriesOfExercises: vi.fn().mockResolvedValue([]),
	} as unknown as WorkoutStatsRepository
	const usersService = {
		getMe: vi.fn().mockResolvedValue({ timezone: 'UTC' }),
	} as unknown as UsersService
	const kcal = {
		getBodyWeightPicker: vi.fn().mockResolvedValue(() => null),
	} as unknown as WorkoutKcalService
	const service = new WorkoutStatsService(statsRepository, usersService, kcal)

	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-10-31T12:00:00Z'))
		findWorkoutsInRange.mockResolvedValue([])
		findEntriesInRange.mockResolvedValue([])
	})
	afterEach(() => {
		vi.useRealTimers()
		vi.clearAllMocks()
	})

	it('widens the window to the end of the current week for the user only', async () => {
		await service.getStats(USER_ID, 'month')
		const expected = {
			userId: USER_ID,
			from: new Date('2026-09-01T00:00:00Z'),
			to: new Date('2026-11-01T00:00:00Z'),
		}
		expect(findWorkoutsInRange).toHaveBeenCalledWith(expected)
		expect(findEntriesInRange).toHaveBeenCalledWith(expected)
	})

	it('does not narrow the window for the week period', async () => {
		await service.getStats(USER_ID, 'week')
		expect(findWorkoutsInRange).toHaveBeenCalledWith(
			expect.objectContaining({ userId: USER_ID, to: new Date('2026-11-01T00:00:00Z') }),
		)
	})
})
