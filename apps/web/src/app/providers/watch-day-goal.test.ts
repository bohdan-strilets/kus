import type { AuthUser, DayResponse } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_QUERY_KEY } from '@/entities/session'
import { markGoalCelebrated, useGoalCelebrationStore } from '@/entities/stats'
import { getLocalDateString } from '@/shared/lib'

import { watchDayGoal } from './watch-day-goal'

const TIMEZONE = 'Europe/Warsaw'
const GOAL_KCAL = 2000
const KCAL_UNDER = 1200
const KCAL_CLOSED = 2000
const KCAL_OVER = 2400
/** 23:30 in Warsaw (UTC+2) on 12 October. */
const BEFORE_MIDNIGHT = '2026-10-12T21:30:00.000Z'
/** 00:30 in Warsaw on 13 October. */
const AFTER_MIDNIGHT = '2026-10-12T22:30:00.000Z'

const user = (id: string): AuthUser => ({
	id,
	email: 'user@example.com',
	name: null,
	addressAs: null,
	addressForm: 'NEUTRAL',
	locale: 'uk',
	timezone: TIMEZONE,
	createdAt: '2026-10-01T10:00:00.000Z',
	pendingDeletion: false,
	purgeAt: null,
})

const USER_A = user('0199b3a4-0000-7000-8000-00000000000a')
const USER_B = user('0199b3a4-0000-7000-8000-00000000000b')

const day = (
	localDate: string,
	kcal: number,
	goalKcal: number | null = GOAL_KCAL,
): DayResponse => ({
	localDate,
	meals: [],
	totals: { kcal, protein: 0, fat: 0, carbs: 0, fiber: 0 },
	goal: goalKcal === null ? null : { kcal: goalKcal, protein: 100, carbs: 200, fat: 60 },
	remainingKcal: goalKcal === null ? null : goalKcal - kcal,
})

const createMemoryStorage = (): Storage => {
	const items = new Map<string, string>()
	return {
		get length() {
			return items.size
		},
		clear: () => {
			items.clear()
		},
		getItem: (key) => items.get(key) ?? null,
		key: (index) => [...items.keys()][index] ?? null,
		removeItem: (key) => {
			items.delete(key)
		},
		setItem: (key, value) => {
			items.set(key, value)
		},
	}
}

const getToday = (): string => getLocalDateString(new Date(), TIMEZONE)
const store = () => useGoalCelebrationStore.getState()

describe('watchDayGoal', () => {
	let queryClient: QueryClient
	let stop: () => void
	let today: string

	const setDay = (date: string, kcal: number, goalKcal: number | null = GOAL_KCAL): void => {
		queryClient.setQueryData(['day', date], day(date, kcal, goalKcal))
	}

	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date(BEFORE_MIDNIGHT))
		vi.stubGlobal('localStorage', createMemoryStorage())
		useGoalCelebrationStore.setState({
			ownerId: null,
			armed: null,
			pending: null,
			celebratedReplyId: null,
		})
		queryClient = new QueryClient()
		queryClient.setQueryData(SESSION_QUERY_KEY, USER_A)
		stop = watchDayGoal(queryClient)
		today = getToday()
	})

	afterEach(() => {
		stop()
		queryClient.clear()
		vi.unstubAllGlobals()
		vi.useRealTimers()
	})

	it('takes the first observation as a baseline only, even when the goal is already closed', () => {
		store().arm('m1')

		setDay(today, KCAL_CLOSED)

		expect(store().pending).toBeNull()
	})

	it('does not celebrate under to closed without a local action', () => {
		setDay(today, KCAL_UNDER)

		setDay(today, KCAL_CLOSED)

		expect(store().pending).toBeNull()
	})

	it('notes under to closed after an armed action, with the date and the reply', () => {
		setDay(today, KCAL_UNDER)
		store().arm('m1')

		setDay(today, KCAL_CLOSED)

		expect(store().pending).toMatchObject({ localDate: today, messageId: 'm1' })
		expect(store().isArmed()).toBe(false)
	})

	it('notes the event once: the same status landing again adds nothing', () => {
		setDay(today, KCAL_UNDER)
		store().arm('m1')
		setDay(today, KCAL_CLOSED)
		const first = store().pending

		store().arm('m2')
		setDay(today, KCAL_CLOSED)

		expect(store().pending).toBe(first)
		expect(store().isArmed()).toBe(true)
	})

	it('does not celebrate a jump from under to over', () => {
		setDay(today, KCAL_UNDER)
		store().arm('m1')

		setDay(today, KCAL_OVER)

		expect(store().pending).toBeNull()
	})

	it('does not celebrate once the arming window has passed', () => {
		setDay(today, KCAL_UNDER)
		store().arm('m1')
		vi.advanceTimersByTime(30_001)

		setDay(today, KCAL_CLOSED)

		expect(store().pending).toBeNull()
	})

	it('ignores the week strip range queries', () => {
		store().arm('m1')
		queryClient.setQueryData(['day', 'range', today, today], [day(today, KCAL_UNDER)])
		queryClient.setQueryData(['day', 'range', today, today], [day(today, KCAL_CLOSED)])

		expect(store().pending).toBeNull()
		expect(store().isArmed()).toBe(true)
	})

	it('ignores other days than today', () => {
		const yesterday = '2026-10-11'
		setDay(yesterday, KCAL_UNDER)
		store().arm('m1')

		setDay(yesterday, KCAL_CLOSED)

		expect(store().pending).toBeNull()
		expect(store().isArmed()).toBe(true)
	})

	it('does not celebrate a day that was already celebrated', () => {
		markGoalCelebrated(USER_A.id, today)
		setDay(today, KCAL_UNDER)
		store().arm('m1')

		setDay(today, KCAL_CLOSED)

		expect(store().pending).toBeNull()
	})

	it('never celebrates without a goal, and forgets the baseline when the goal disappears', () => {
		setDay(today, KCAL_UNDER, null)
		store().arm('m1')
		setDay(today, KCAL_CLOSED, null)
		expect(store().pending).toBeNull()

		// the goal is set: the next observation is a first one again
		setDay(today, KCAL_CLOSED)
		expect(store().pending).toBeNull()
	})

	it('ignores a day response that does not match the schema', () => {
		setDay(today, KCAL_UNDER)
		store().arm('m1')

		queryClient.setQueryData(['day', today], { localDate: today })

		expect(store().pending).toBeNull()
	})

	it('does nothing while the session is unknown', () => {
		queryClient.setQueryData(SESSION_QUERY_KEY, null)
		setDay(today, KCAL_UNDER)
		store().arm('m1')

		setDay(today, KCAL_CLOSED)

		expect(store().pending).toBeNull()
	})

	it('starts from a fresh baseline for another user', () => {
		setDay(today, KCAL_UNDER)
		queryClient.setQueryData(SESSION_QUERY_KEY, USER_B)
		store().arm('m1')

		// would be under to closed for user A; for user B it is a first observation
		setDay(today, KCAL_CLOSED)

		expect(store().pending).toBeNull()
	})

	it('does not celebrate yesterday after midnight, but celebrates the new day', () => {
		setDay(today, KCAL_UNDER)
		store().arm('m1')
		vi.setSystemTime(new Date(AFTER_MIDNIGHT))
		const newToday = getToday()
		expect(newToday).not.toBe(today)

		setDay(today, KCAL_CLOSED)
		expect(store().pending).toBeNull()

		setDay(newToday, KCAL_UNDER)
		store().arm('m2')
		setDay(newToday, KCAL_CLOSED)

		expect(store().pending).toMatchObject({ localDate: newToday, messageId: 'm2' })
	})
})
