import { describe, expect, it } from 'vitest'

import { buildWorkoutStats } from './workout-stats'
import { getBurned } from './workout-stats-burned'
import { makeEntry, makeWorkout } from './workout-stats.test-utils'

const known = (): number => 80
const unknown = (): null => null

describe('getBurned', () => {
	it('an estimated workout is an estimate', () => {
		const result = getBurned({
			workouts: [makeWorkout()],
			entries: [makeEntry()],
			getBodyWeightKg: known,
		})
		expect(result).toEqual({ kcal: 200, isEstimate: true })
	})

	it('sums named and estimated workouts; any estimate makes the sum an estimate', () => {
		const result = getBurned({
			workouts: [
				makeWorkout({ id: 'w1', kcalBurned: 333, kcalSource: 'MANUAL' }),
				makeWorkout({ id: 'w2' }),
			],
			entries: [makeEntry({ workoutId: 'w2' })],
			getBodyWeightKg: known,
		})
		expect(result).toEqual({ kcal: 533, isEstimate: true })
	})

	it('all named is not an estimate, and needs no body weight', () => {
		const result = getBurned({
			workouts: [
				makeWorkout({ id: 'w1', kcalBurned: 300, kcalSource: 'DEVICE' }),
				makeWorkout({ id: 'w2', kcalBurned: 120, kcalSource: 'MANUAL' }),
			],
			entries: [],
			getBodyWeightKg: unknown,
		})
		expect(result).toEqual({ kcal: 420, isEstimate: false })
	})

	it('a named AI_ESTIMATE workout counts as an estimate', () => {
		const result = getBurned({
			workouts: [makeWorkout({ kcalBurned: 300, kcalSource: 'AI_ESTIMATE' })],
			entries: [],
			getBodyWeightKg: unknown,
		})
		expect(result).toEqual({ kcal: 300, isEstimate: true })
	})

	it('without a body weight and nothing named is null', () => {
		const result = getBurned({
			workouts: [makeWorkout()],
			entries: [makeEntry()],
			getBodyWeightKg: unknown,
		})
		expect(result).toBeNull()
	})

	it('a period with no workouts is null', () => {
		expect(getBurned({ workouts: [], entries: [], getBodyWeightKg: known })).toBeNull()
	})

	it('asks for the body weight by the day of each workout', () => {
		const seen: string[] = []
		getBurned({
			workouts: [
				makeWorkout({ id: 'w1', localDate: '2026-10-27' }),
				makeWorkout({ id: 'w2', localDate: '2026-10-28' }),
			],
			entries: [],
			getBodyWeightKg: (day) => {
				seen.push(day)
				return 80
			},
		})
		expect(seen).toEqual(['2026-10-27', '2026-10-28'])
	})
})

describe('buildWorkoutStats overview.burned', () => {
	const base = {
		period: 'week' as const,
		today: '2026-10-28',
		firstWorkoutDate: null,
		workouts: [makeWorkout()],
		entries: [makeEntry()],
		allTimeStrengthEntries: [],
	}

	it('is null by default (no body weight picker)', () => {
		expect(buildWorkoutStats(base).overview.burned).toBeNull()
	})

	it('uses the picker', () => {
		const stats = buildWorkoutStats({ ...base, getBodyWeightKg: known })
		expect(stats.overview.burned).toEqual({ kcal: 200, isEstimate: true })
	})
})
