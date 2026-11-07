import { describe, expect, it } from 'vitest'

import { makeExercise, makeLiveResponse, makeWorkout } from '@/shared/testing'

import { getLastLiveActionAt, isLiveFresh } from './get-last-live-action'

const STARTED = '2026-11-02T09:00:00.000Z'
const HOUR_MS = 3_600_000
const NOW = new Date('2026-11-02T20:00:00.000Z')

const set = (doneAt: string | null) => ({
	reps: 8,
	weightKg: 50,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	doneAt,
})

const liveWith = (exercises: ReturnType<typeof makeExercise>[], startedAt = STARTED) =>
	makeLiveResponse({
		workout: makeWorkout({ source: 'LIVE', startedAt, exercises }),
	})

describe('getLastLiveActionAt', () => {
	it('is startedAt when there are no exercises', () => {
		expect(getLastLiveActionAt(liveWith([]))).toEqual(new Date(STARTED))
	})

	it('takes the newest of doneAt, performedAt and startedAt', () => {
		const live = liveWith([
			makeExercise({
				performedAt: '2026-11-02T09:30:00.000Z',
				sets: [set('2026-11-02T09:40:00.000Z'), set('2026-11-02T10:15:00.000Z'), set(null)],
			}),
			makeExercise({ performedAt: '2026-11-02T10:05:00.000Z', sets: [set(null)] }),
		])

		expect(getLastLiveActionAt(live)).toEqual(new Date('2026-11-02T10:15:00.000Z'))
	})

	it('a performedAt later than every doneAt wins', () => {
		const live = liveWith([
			makeExercise({
				performedAt: '2026-11-02T11:00:00.000Z',
				sets: [set('2026-11-02T10:00:00.000Z')],
			}),
		])

		expect(getLastLiveActionAt(live)).toEqual(new Date('2026-11-02T11:00:00.000Z'))
	})

	it('falls back to startedAt when the exercises are older than it', () => {
		const live = liveWith([
			makeExercise({
				performedAt: '2026-11-02T08:00:00.000Z',
				sets: [set('2026-11-02T08:10:00.000Z')],
			}),
		])

		expect(getLastLiveActionAt(live)).toEqual(new Date(STARTED))
	})

	it('ignores a value that is not a date', () => {
		const live = liveWith([makeExercise({ performedAt: 'broken', sets: [set('nope')] })])

		expect(getLastLiveActionAt(live)).toEqual(new Date(STARTED))
	})

	it('is null when nothing parses', () => {
		expect(getLastLiveActionAt(liveWith([], 'broken'))).toBeNull()
	})
})

describe('isLiveFresh', () => {
	const startedAgo = (ms: number): string => new Date(NOW.getTime() - ms).toISOString()

	it('is open at exactly 3 hours', () => {
		expect(isLiveFresh(liveWith([], startedAgo(3 * HOUR_MS)), NOW)).toBe(true)
	})

	it('is stale at 3 hours and 1 ms', () => {
		expect(isLiveFresh(liveWith([], startedAgo(3 * HOUR_MS + 1)), NOW)).toBe(false)
	})

	it('a recent set keeps an old session fresh', () => {
		const live = liveWith(
			[makeExercise({ performedAt: startedAgo(10 * HOUR_MS), sets: [set(startedAgo(HOUR_MS))] })],
			startedAgo(10 * HOUR_MS),
		)

		expect(isLiveFresh(live, NOW)).toBe(true)
	})

	it('is not fresh when no time is known', () => {
		expect(isLiveFresh(liveWith([], 'broken'), NOW)).toBe(false)
	})
})
