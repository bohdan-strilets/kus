import { describe, expect, it } from 'vitest'

import {
	findSessionToClose,
	getNewSessionReason,
	getRecordKeys,
	getSessionMessageIds,
	hasNewRecord,
	inheritEntryOrigins,
	placeAfter,
	toWorkoutCard,
} from './workout-session'
import type { WorkoutWithExercises } from './workouts.repository'

const NOW = new Date('2026-10-31T19:00:00Z')
const HOUR_MS = 60 * 60 * 1000
const hoursAgo = (hours: number): Date => new Date(NOW.getTime() - hours * HOUR_MS)

type Session = Parameters<typeof getNewSessionReason>[0]['workout']

const session = (overrides: Partial<NonNullable<Session>> = {}): NonNullable<Session> => ({
	deletedAt: null,
	place: 'GYM',
	exercises: [
		{ performedAt: hoursAgo(1) },
		{ performedAt: hoursAgo(0.5) },
	] as WorkoutWithExercises['exercises'],
	...overrides,
})

describe('getNewSessionReason', () => {
	it('appends to an open session at the same or an unnamed place', () => {
		expect(getNewSessionReason({ workout: session(), place: null, now: NOW })).toBeNull()
		expect(getNewSessionReason({ workout: session(), place: 'GYM', now: NOW })).toBeNull()
		expect(
			getNewSessionReason({ workout: session({ place: null }), place: 'HOME', now: NOW }),
		).toBeNull()
	})

	it('starts a new session when the session is gone', () => {
		expect(getNewSessionReason({ workout: null, place: null, now: NOW })).toBe('deleted')
		expect(
			getNewSessionReason({
				workout: session({ deletedAt: hoursAgo(0.1) }),
				place: null,
				now: NOW,
			}),
		).toBe('deleted')
	})

	it('measures the 3 h from the last entry, not the first', () => {
		const exercises = [
			{ performedAt: hoursAgo(5) },
			{ performedAt: hoursAgo(3) },
		] as WorkoutWithExercises['exercises']
		expect(
			getNewSessionReason({ workout: session({ exercises }), place: null, now: NOW }),
		).toBeNull()
	})

	it('starts a new session when the last entry is more than 3 h old', () => {
		const exercises = [{ performedAt: hoursAgo(3.1) }] as WorkoutWithExercises['exercises']
		expect(getNewSessionReason({ workout: session({ exercises }), place: null, now: NOW })).toBe(
			'stale',
		)
		expect(
			getNewSessionReason({ workout: session({ exercises: [] }), place: null, now: NOW }),
		).toBe('stale')
	})

	it('starts a new session when both places are named and differ', () => {
		expect(getNewSessionReason({ workout: session(), place: 'HOME', now: NOW })).toBe('place')
	})
})

describe('inheritEntryOrigins', () => {
	const fallback = { sourceMessageId: 'm-first', performedAt: NOW }

	it('gives the n-th new entry of an exercise the message and time of its n-th old entry', () => {
		const oldEntries = [
			{ exerciseId: 'bench', sourceMessageId: 'm1', performedAt: hoursAgo(2) },
			{ exerciseId: 'squat', sourceMessageId: 'm2', performedAt: hoursAgo(1) },
			{ exerciseId: 'bench', sourceMessageId: 'm3', performedAt: hoursAgo(0.5) },
		]

		const origins = inheritEntryOrigins({
			oldEntries,
			newExerciseIds: ['squat', 'bench', 'bench', 'bench', 'row'],
			fallback,
		})

		expect(origins).toEqual([
			{ sourceMessageId: 'm2', performedAt: hoursAgo(1) },
			{ sourceMessageId: 'm1', performedAt: hoursAgo(2) },
			{ sourceMessageId: 'm3', performedAt: hoursAgo(0.5) },
			fallback,
			fallback,
		])
	})

	it('never matches an old entry whose exercise is gone', () => {
		const origins = inheritEntryOrigins({
			oldEntries: [{ exerciseId: null, sourceMessageId: 'm1', performedAt: hoursAgo(1) }],
			newExerciseIds: ['bench'],
			fallback,
		})
		expect(origins).toEqual([fallback])
	})
})

const entry = (id: string, sourceMessageId: string | null) =>
	({ id, sourceMessageId }) as WorkoutWithExercises['exercises'][number]

describe('toWorkoutCard', () => {
	const workout = {
		id: 'w',
		finishedMessageId: 'm3',
		exercises: [entry('e1', 'm1'), entry('e2', 'm2'), entry('e3', 'm2'), entry('e4', 'm3')],
	}

	it('shows the summary of the whole session on the message that finished it', () => {
		expect(toWorkoutCard(workout, 'm3')).toEqual({
			workoutId: 'w',
			variant: 'SUMMARY',
			exerciseIds: ['e1', 'e2', 'e3', 'e4'],
		})
	})

	it('shows the exercises a message added on that message', () => {
		expect(toWorkoutCard(workout, 'm2')).toEqual({
			workoutId: 'w',
			variant: 'EXERCISES',
			exerciseIds: ['e2', 'e3'],
		})
	})

	it('has no card on a message without a part of the session', () => {
		expect(toWorkoutCard(workout, 'm9')).toBeNull()
		expect(toWorkoutCard({ ...workout, finishedMessageId: null }, 'm3')).toEqual({
			workoutId: 'w',
			variant: 'EXERCISES',
			exerciseIds: ['e4'],
		})
	})
})

describe('getSessionMessageIds', () => {
	it('lists each message of the entries and the finish once', () => {
		expect(
			getSessionMessageIds({
				finishedMessageId: 'm3',
				exercises: [entry('e1', 'm1'), entry('e2', 'm1'), entry('e3', null), entry('e4', 'm3')],
			}),
		).toEqual(['m1', 'm3'])
	})
})

describe('hasNewRecord', () => {
	const entries = [
		{ id: 'old-bench', exerciseId: 'bench' },
		{ id: 'new-bench', exerciseId: 'bench' },
		{ id: 'squat', exerciseId: 'squat' },
		{ id: 'gone', exerciseId: null },
	]

	it('is false when the record only moved to another entry of the same exercise', () => {
		const before = getRecordKeys([{ exerciseEntryId: 'old-bench', type: 'WEIGHT' }], entries)
		const after = getRecordKeys([{ exerciseEntryId: 'new-bench', type: 'WEIGHT' }], entries)
		expect(hasNewRecord(before, after)).toBe(false)
	})

	it('is true for a record of another exercise or another type', () => {
		const before = getRecordKeys([{ exerciseEntryId: 'old-bench', type: 'WEIGHT' }], entries)
		expect(
			hasNewRecord(before, getRecordKeys([{ exerciseEntryId: 'squat', type: 'WEIGHT' }], entries)),
		).toBe(true)
		expect(
			hasNewRecord(
				before,
				getRecordKeys([{ exerciseEntryId: 'old-bench', type: 'REPS' }], entries),
			),
		).toBe(true)
	})

	it('is false without records and ignores entries whose exercise is gone', () => {
		expect(hasNewRecord(new Set(), new Set())).toBe(false)
		expect(
			hasNewRecord(
				new Set(),
				getRecordKeys([{ exerciseEntryId: 'gone', type: 'WEIGHT' }], entries),
			),
		).toBe(false)
	})
})

describe('findSessionToClose', () => {
	const at = (hours: number) =>
		[{ performedAt: hoursAgo(hours) }] as WorkoutWithExercises['exercises']
	const day = (sessions: Partial<NonNullable<Session> & { finishedAt: Date | null }>[]) =>
		sessions.map((overrides) => ({
			deletedAt: null,
			finishedAt: null,
			exercises: at(1),
			...overrides,
		}))

	it('takes the last open live session of the day', () => {
		const sessions = day([{ exercises: at(5) }, { exercises: at(4) }, { finishedAt: hoursAgo(1) }])
		expect(findSessionToClose(sessions)).toBe(sessions[1])
	})

	it('skips deleted sessions and sessions without entries', () => {
		const sessions = day([{ exercises: at(5) }, { deletedAt: hoursAgo(1) }, { exercises: [] }])
		expect(findSessionToClose(sessions)).toBe(sessions[0])
	})

	it('finds none when every session is finished or deleted', () => {
		expect(
			findSessionToClose(day([{ finishedAt: hoursAgo(1) }, { deletedAt: hoursAgo(1) }])),
		).toBeNull()
		expect(findSessionToClose([])).toBeNull()
	})
})

describe('placeAfter', () => {
	it('puts added rows after the highest position the session has', () => {
		const rows = [
			{ position: 0, name: 'a' },
			{ position: 1, name: 'b' },
		]
		expect(placeAfter(rows, 4).map(({ position }) => position)).toEqual([5, 6])
	})

	it('starts at 0 in a session without rows', () => {
		expect(placeAfter([{ position: 7 }], null)).toEqual([{ position: 0 }])
	})
})

describe('inheritEntryOrigins in a fix', () => {
	it('gives an exercise new to the session the fixing message, and keeps the others where they were', () => {
		const fix = { sourceMessageId: 'm-fix', performedAt: NOW }
		const origins = inheritEntryOrigins({
			oldEntries: [{ exerciseId: 'bench', sourceMessageId: 'm1', performedAt: hoursAgo(1) }],
			newExerciseIds: ['bench', 'squat'],
			fallback: fix,
		})
		expect(origins).toEqual([{ sourceMessageId: 'm1', performedAt: hoursAgo(1) }, fix])
	})
})
