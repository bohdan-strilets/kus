import { LIVE_FINISH_IDLE_MIN, MAX_WORKOUT_MINUTES } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import {
	clampLiveFinishAt,
	getLastActionAt,
	getLastDoneAt,
	getDoneSets,
	getLastWorkAt,
	getLiveDurationMin,
	getLiveFinishedAt,
	getLiveFinishFields,
	hasDoneWork,
	isDoneExercise,
	isLiveIdle,
	isOpenLive,
} from './live-session'
import { getNewSessionReason } from './workout-session'

const MINUTE_MS = 60_000
const NOW = new Date('2026-11-10T23:10:00Z')
const minutesAgo = (minutes: number, from: Date = NOW): Date =>
	new Date(from.getTime() - minutes * MINUTE_MS)

type Exercises = Parameters<typeof getLastWorkAt>[0]['exercises']

const exerciseDoneAt = (performedAt: Date, doneAts: (Date | null)[] = []): Exercises[number] => ({
	performedAt,
	sets: doneAts.map((doneAt) => ({ doneAt })),
})

const liveSession = (startedAt: Date, exercises: Exercises = []) => ({ startedAt, exercises })

describe('isOpenLive', () => {
	const state = (overrides: Partial<Parameters<typeof isOpenLive>[0]> = {}) => ({
		source: 'LIVE' as const,
		finishedAt: null,
		deletedAt: null,
		...overrides,
	})

	it('is open only for a not finished, not deleted LIVE session', () => {
		expect(isOpenLive(state())).toBe(true)
		expect(isOpenLive(state({ finishedAt: NOW }))).toBe(false)
		expect(isOpenLive(state({ deletedAt: NOW }))).toBe(false)
		expect(isOpenLive(state({ source: 'FORM' }))).toBe(false)
	})
})

describe('getLastWorkAt / getLastActionAt', () => {
	it('takes the latest of sets doneAt and entries performedAt', () => {
		const exercises = [
			exerciseDoneAt(minutesAgo(50), [minutesAgo(40), null]),
			exerciseDoneAt(minutesAgo(30), [minutesAgo(10)]),
		]
		expect(getLastWorkAt({ exercises })).toEqual(minutesAgo(10))
	})

	it('is null without any work, and the start is then the last action', () => {
		expect(getLastWorkAt({ exercises: [] })).toBeNull()
		const startedAt = minutesAgo(20)
		expect(getLastActionAt(liveSession(startedAt))).toEqual(startedAt)
	})

	it('ignores sets that are not done', () => {
		const exercises = [exerciseDoneAt(minutesAgo(60), [null, null])]
		expect(getLastWorkAt({ exercises })).toEqual(minutesAgo(60))
	})
})

describe('isLiveIdle (the 3 h gap, never the calendar day)', () => {
	it('stays open through midnight: the last set at 23:30 local, now 00:10 next day', () => {
		// Europe/Warsaw (UTC+1 in November): 23:30 local = 22:30Z, 00:10 local = 23:10Z
		const lastSet = new Date('2026-11-10T22:30:00Z')
		const session = liveSession(minutesAgo(90, lastSet), [
			exerciseDoneAt(minutesAgo(40, lastSet), [lastSet]),
		])
		expect(isLiveIdle(session, NOW)).toBe(false)
	})

	it('is idle at 3 h 01 min since the last action and open at 2 h 59 min and at exactly 3 h', () => {
		const at = (minutes: number) =>
			liveSession(minutesAgo(600), [exerciseDoneAt(minutesAgo(minutes + 5), [minutesAgo(minutes)])])
		expect(isLiveIdle(at(3 * 60 + 1), NOW)).toBe(true)
		expect(isLiveIdle(at(2 * 60 + 59), NOW)).toBe(false)
		expect(isLiveIdle(at(3 * 60), NOW)).toBe(false)
	})

	it('measures from the start when nothing was done yet', () => {
		expect(isLiveIdle(liveSession(minutesAgo(3 * 60 + 1)), NOW)).toBe(true)
		expect(isLiveIdle(liveSession(minutesAgo(5)), NOW)).toBe(false)
	})

	it('is idle without start and work', () => {
		expect(isLiveIdle({ startedAt: null, exercises: [] }, NOW)).toBe(true)
	})

	it('uses the latest set, not the first one', () => {
		const session = liveSession(minutesAgo(400), [
			exerciseDoneAt(minutesAgo(400), [minutesAgo(390)]),
			exerciseDoneAt(minutesAgo(30), [minutesAgo(20)]),
		])
		expect(isLiveIdle(session, NOW)).toBe(false)
	})
})

describe('hasDoneWork', () => {
	const entry = (overrides: Record<string, unknown>) => ({
		clientKey: null,
		sets: [],
		durationMin: null,
		distanceM: null,
		...overrides,
	})
	const workoutOf = (exercises: unknown[]) =>
		({ exercises }) as unknown as Parameters<typeof hasDoneWork>[0]
	const done = { doneAt: NOW }
	const planned = { doneAt: null }

	it('a live exercise (clientKey) with only planned sets is not work', () => {
		expect(hasDoneWork(workoutOf([entry({ clientKey: 'k', sets: [planned, planned] })]))).toBe(
			false,
		)
	})

	it('a live exercise with at least one set done is work', () => {
		expect(hasDoneWork(workoutOf([entry({ clientKey: 'k', sets: [planned, done] })]))).toBe(true)
	})

	it('an exercise told in the chat (no clientKey) with any set is work, planned or not', () => {
		expect(hasDoneWork(workoutOf([entry({ sets: [planned] })]))).toBe(true)
		expect(hasDoneWork(workoutOf([entry({ sets: [done] })]))).toBe(true)
	})

	it('a cardio time or distance is work, for a live exercise too', () => {
		expect(hasDoneWork(workoutOf([entry({ durationMin: 10 })]))).toBe(true)
		expect(hasDoneWork(workoutOf([entry({ distanceM: 500 })]))).toBe(true)
		expect(hasDoneWork(workoutOf([entry({ clientKey: 'k', durationMin: 10 })]))).toBe(true)
	})

	it('an exercise told in the chat (no clientKey) is work even without sets or numbers', () => {
		expect(hasDoneWork(workoutOf([entry({})]))).toBe(true)
	})

	it('is false for an empty list and for a live exercise with nothing in it', () => {
		expect(hasDoneWork(workoutOf([]))).toBe(false)
		expect(hasDoneWork(workoutOf([entry({ clientKey: 'k' })]))).toBe(false)
	})
})

describe('isDoneExercise / getDoneSets', () => {
	const exercise = (overrides: Partial<Parameters<typeof isDoneExercise>[0]> = {}) => ({
		clientKey: null,
		sets: [],
		durationMin: null,
		distanceM: null,
		...overrides,
	})
	const done = { doneAt: NOW }
	const planned = { doneAt: null }

	it('isDoneExercise: chat exercise always, live only with a done set or cardio numbers', () => {
		expect(isDoneExercise(exercise())).toBe(true)
		expect(isDoneExercise(exercise({ sets: [planned] }))).toBe(true)
		expect(isDoneExercise(exercise({ clientKey: 'k' }))).toBe(false)
		expect(isDoneExercise(exercise({ clientKey: 'k', sets: [planned, planned] }))).toBe(false)
		expect(isDoneExercise(exercise({ clientKey: 'k', sets: [planned, done] }))).toBe(true)
		expect(isDoneExercise(exercise({ clientKey: 'k', durationMin: 5 }))).toBe(true)
		expect(isDoneExercise(exercise({ clientKey: 'k', distanceM: 100 }))).toBe(true)
	})

	it('hasDoneWork agrees with isDoneExercise over the list', () => {
		const list = [exercise({ clientKey: 'k' }), exercise({ clientKey: 'k2', sets: [done] })]
		expect(hasDoneWork({ exercises: list })).toBe(list.some(isDoneExercise))
		expect(hasDoneWork({ exercises: list.slice(0, 1) })).toBe(false)
	})

	it('getDoneSets: all sets of a chat exercise, only done ones of a live exercise', () => {
		const sets = [planned, done, planned]
		expect(getDoneSets({ clientKey: null, sets })).toEqual(sets)
		expect(getDoneSets({ clientKey: 'k', sets })).toEqual([done])
		expect(getDoneSets({ clientKey: 'k', sets: [planned] })).toEqual([])
		expect(getDoneSets({ clientKey: 'k', sets: [] })).toEqual([])
		expect(getDoneSets({ clientKey: null, sets: [] })).toEqual([])
	})

	it('getDoneSets keeps the generic set type and the order, without mutating the input', () => {
		const sets = [
			{ doneAt: null, reps: 1 },
			{ doneAt: NOW, reps: 2 },
			{ doneAt: NOW, reps: 3 },
		]
		const result = getDoneSets({ clientKey: 'k', sets })
		expect(result.map((set) => set.reps)).toEqual([2, 3])
		expect(sets).toHaveLength(3)
	})
})

describe('getLiveFinishedAt (late finish)', () => {
	const sessionWithLastSet = (minutes: number) => ({
		exercises: [exerciseDoneAt(minutesAgo(minutes + 5), [minutesAgo(minutes)])],
	})

	it('is now when the last set was 10 min ago', () => {
		expect(getLiveFinishedAt(sessionWithLastSet(10), NOW)).toEqual(NOW)
	})

	it('is the last set when it was done longer than LIVE_FINISH_IDLE_MIN ago', () => {
		const late = LIVE_FINISH_IDLE_MIN + 1
		expect(getLiveFinishedAt(sessionWithLastSet(late), NOW)).toEqual(minutesAgo(late))
	})

	it('is now at exactly LIVE_FINISH_IDLE_MIN', () => {
		expect(getLiveFinishedAt(sessionWithLastSet(LIVE_FINISH_IDLE_MIN), NOW)).toEqual(NOW)
	})

	it('is now without any work', () => {
		expect(getLiveFinishedAt({ exercises: [] }, NOW)).toEqual(NOW)
	})
})

describe('clampLiveFinishAt / getLastDoneAt', () => {
	const startedAt = minutesAgo(60)
	const lastDoneAt = minutesAgo(20)
	const clamp = (requestedAt: Date | null, done: Date | null = lastDoneAt): Date =>
		clampLiveFinishAt({ requestedAt, startedAt, lastDoneAt: done, now: NOW })

	it('keeps a tap between the last set and now', () => {
		expect(clamp(minutesAgo(5))).toEqual(minutesAgo(5))
	})

	it('is now without a tap', () => {
		expect(clamp(null)).toEqual(NOW)
	})

	it('moves a tap in the future to now', () => {
		expect(clamp(minutesAgo(-30))).toEqual(NOW)
	})

	it('moves a tap before the last set to that set', () => {
		expect(clamp(minutesAgo(30))).toEqual(lastDoneAt)
	})

	it('moves a tap before the start to the start when no set is done', () => {
		expect(clamp(minutesAgo(90), null)).toEqual(startedAt)
	})

	it('never goes past now when the lower bound does', () => {
		expect(clamp(minutesAgo(30), minutesAgo(-10))).toEqual(NOW)
	})

	it('a late tap ends the session at the last set (getLiveFinishedAt), not at the tap', () => {
		const tap = clamp(minutesAgo(1))
		const exercises = [exerciseDoneAt(minutesAgo(LIVE_FINISH_IDLE_MIN + 25), [minutesAgo(50)])]
		expect(getLiveFinishedAt({ exercises }, tap)).toEqual(minutesAgo(50))
	})

	it('a cardio row left at the write time (no sets) with the tap before it: finished at the tap', () => {
		const tap = minutesAgo(15)
		const cardio = exerciseDoneAt(NOW)
		const { finishedAt } = getLiveFinishFields(
			{ exercises: [cardio], startedAt, durationMin: null },
			{
				now: tap,
			},
		)
		expect(finishedAt).toEqual(tap)
	})

	it('after the write is capped to the end (last set, or the tap), a late tap ends at the last set', () => {
		const lastSet = minutesAgo(60)
		const tap = minutesAgo(15)
		const endsAt = getLiveFinishedAt({ exercises: [exerciseDoneAt(lastSet)] }, tap)
		// the stored rows: cardio written at NOW, capped by capLivePerformedAt(endsAt)
		const cap = (date: Date): Date => new Date(Math.min(date.getTime(), endsAt.getTime()))
		const stored = [
			exerciseDoneAt(cap(minutesAgo(80)), [minutesAgo(80), lastSet]),
			exerciseDoneAt(cap(NOW)),
		]
		const { finishedAt } = getLiveFinishFields(
			{ exercises: stored, startedAt, durationMin: null },
			{ now: tap },
		)
		expect(finishedAt).toEqual(lastSet)
		expect(stored.every((row) => row.performedAt <= finishedAt)).toBe(true)
	})

	it('getLastDoneAt reads sets only, not performedAt', () => {
		const exercises = [exerciseDoneAt(NOW), exerciseDoneAt(NOW, [minutesAgo(30), minutesAgo(40)])]
		expect(getLastDoneAt({ exercises })).toEqual(minutesAgo(30))
		expect(getLastDoneAt({ exercises: [exerciseDoneAt(NOW)] })).toBeNull()
	})
})

describe('getLiveDurationMin', () => {
	const startedAt = new Date('2026-11-10T20:00:00Z')

	it('is whole minutes from the start to the finish', () => {
		expect(getLiveDurationMin({ startedAt, finishedAt: minutesAgo(-47, startedAt) })).toBe(47)
	})

	it('is at least 1 minute (also for a finish before the start)', () => {
		expect(getLiveDurationMin({ startedAt, finishedAt: startedAt })).toBe(1)
		expect(getLiveDurationMin({ startedAt, finishedAt: minutesAgo(5, startedAt) })).toBe(1)
	})

	it('is at most MAX_WORKOUT_MINUTES', () => {
		const finishedAt = minutesAgo(-(MAX_WORKOUT_MINUTES + 500), startedAt)
		expect(getLiveDurationMin({ startedAt, finishedAt })).toBe(MAX_WORKOUT_MINUTES)
	})
})

describe('getLiveFinishFields', () => {
	const startedAt = minutesAgo(120)
	const base = (lastSetMinutesAgo: number, durationMin: number | null = null) => ({
		startedAt,
		durationMin,
		exercises: [exerciseDoneAt(minutesAgo(lastSetMinutesAgo + 5), [minutesAgo(lastSetMinutesAgo)])],
	})

	it('finishes now with the duration from the start when the last set is fresh', () => {
		expect(getLiveFinishFields(base(10), { now: NOW })).toEqual({
			finishedAt: NOW,
			durationMin: 120,
		})
	})

	it('finishes at the last set, and the duration is counted to it, not to now', () => {
		const fields = getLiveFinishFields(base(70), { now: NOW })
		expect(fields.finishedAt).toEqual(minutesAgo(70))
		expect(fields.durationMin).toBe(50)
	})

	it('finishes at the message when it adds exercises, whatever the last set', () => {
		const fields = getLiveFinishFields(base(70), { now: NOW, addsExercises: true })
		expect(fields).toEqual({ finishedAt: NOW, durationMin: 120 })
	})

	it('keeps a duration someone named: the stored one, the named one first', () => {
		expect(getLiveFinishFields(base(10, 45), { now: NOW }).durationMin).toBe(45)
		expect(getLiveFinishFields(base(10, 45), { now: NOW, namedDurationMin: 60 }).durationMin).toBe(
			60,
		)
	})

	it('the idle auto-close case (last set 3 h 30 min ago) ends at that set, duration clamped to 1', () => {
		const fields = getLiveFinishFields(base(210), { now: NOW })
		expect(fields.finishedAt).toEqual(minutesAgo(210))
		expect(fields.durationMin).toBe(1) // the last set is earlier than the start
	})
})

describe('getNewSessionReason for an open LIVE session', () => {
	const live = (
		startedAt: Date,
		exercises: Exercises,
		overrides: Record<string, unknown> = {},
	): Parameters<typeof getNewSessionReason>[0]['workout'] =>
		({
			deletedAt: null,
			place: 'GYM',
			source: 'LIVE',
			finishedAt: null,
			startedAt,
			exercises,
			...overrides,
		}) as unknown as Parameters<typeof getNewSessionReason>[0]['workout']

	it('appends while the last action is within 3 h, also across midnight', () => {
		const lastSet = new Date('2026-11-10T22:30:00Z')
		const workout = live(minutesAgo(120, lastSet), [exerciseDoneAt(lastSet, [lastSet])])
		expect(getNewSessionReason({ workout, place: null, now: NOW })).toBeNull()
	})

	it('is stale only when idle', () => {
		const workout = live(minutesAgo(600), [exerciseDoneAt(minutesAgo(250), [minutesAgo(200)])])
		expect(getNewSessionReason({ workout, place: null, now: NOW })).toBe('stale')
	})

	it('never says «place»: a differing place still appends', () => {
		const workout = live(minutesAgo(30), [exerciseDoneAt(minutesAgo(20), [minutesAgo(10)])])
		expect(getNewSessionReason({ workout, place: 'HOME', now: NOW })).toBeNull()
	})

	it('counts the start when nothing was done yet', () => {
		expect(
			getNewSessionReason({ workout: live(minutesAgo(10), []), place: null, now: NOW }),
		).toBeNull()
		expect(getNewSessionReason({ workout: live(minutesAgo(200), []), place: null, now: NOW })).toBe(
			'stale',
		)
	})

	it('a deleted live session is «deleted»', () => {
		const workout = live(minutesAgo(10), [], { deletedAt: NOW })
		expect(getNewSessionReason({ workout, place: null, now: NOW })).toBe('deleted')
	})

	it('a finished LIVE session follows the chat rule (place can differ)', () => {
		const workout = live(minutesAgo(30), [exerciseDoneAt(minutesAgo(10))], { finishedAt: NOW })
		expect(getNewSessionReason({ workout, place: 'HOME', now: NOW })).toBe('place')
	})
})
