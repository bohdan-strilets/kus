import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hasCelebratedGoal, markGoalCelebrated } from '../lib/goal-celebrated-flag'
import {
	GOAL_ARM_WINDOW_MS,
	GOAL_PENDING_TTL_MS,
	useGoalCelebrationStore,
} from './goal-celebration-store'

const USER_A = '0199b3a4-0000-7000-8000-00000000000a'
const USER_B = '0199b3a4-0000-7000-8000-00000000000b'
const TODAY = '2026-10-12'
const REPLY_ID = '0199b3a4-0000-7000-8000-000000000011'
const T0 = 1_000_000

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

const store = () => useGoalCelebrationStore.getState()

describe('useGoalCelebrationStore', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', createMemoryStorage())
		useGoalCelebrationStore.setState({
			ownerId: null,
			armed: null,
			pending: null,
			celebratedReplyId: null,
		})
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.useRealTimers()
	})

	describe('arming', () => {
		it('is not armed until a local action arms it', () => {
			expect(store().isArmed(T0)).toBe(false)
		})

		it('stays armed inside the window and stops exactly at its end', () => {
			store().arm(REPLY_ID, { now: T0 })

			expect(store().isArmed(T0)).toBe(true)
			expect(store().isArmed(T0 + GOAL_ARM_WINDOW_MS - 1)).toBe(true)
			expect(store().isArmed(T0 + GOAL_ARM_WINDOW_MS)).toBe(false)
		})

		it('follows the fake clock when no time is passed', () => {
			vi.useFakeTimers()
			vi.setSystemTime(T0)
			store().arm(null)

			vi.advanceTimersByTime(GOAL_ARM_WINDOW_MS - 1)
			expect(store().isArmed()).toBe(true)

			vi.advanceTimersByTime(1)
			expect(store().isArmed()).toBe(false)
		})

		it('is one-shot: a detection takes the messageId and disarms', () => {
			store().arm(REPLY_ID, { now: T0 })

			store().setPending(TODAY, T0 + 100)

			expect(store().isArmed(T0 + 100)).toBe(false)
			expect(store().pending).toEqual({
				localDate: TODAY,
				messageId: REPLY_ID,
				detectedAt: T0 + 100,
				isQuiet: false,
			})
		})
	})

	describe('consume', () => {
		const detect = (messageId: string | null = REPLY_ID): void => {
			store().arm(messageId, { now: T0 })
			store().setPending(TODAY, T0)
		}

		it('returns nothing without a pending goal', () => {
			expect(store().consume({ userId: USER_A, today: TODAY, now: T0 })).toBeNull()
		})

		it('returns the event with detectedAt, writes no flag and does not reveal the reply yet', () => {
			detect()

			const event = store().consume({ userId: USER_A, today: TODAY, now: T0 + 1000 })

			expect(event).toEqual({
				localDate: TODAY,
				messageId: REPLY_ID,
				detectedAt: T0,
				isQuiet: false,
			})
			expect(hasCelebratedGoal(USER_A, TODAY)).toBe(false)
			expect(store().celebratedReplyId).toBeNull()
			expect(store().pending).toBeNull()
		})

		it('reveals the reply only through revealReply', () => {
			store().revealReply(REPLY_ID)
			expect(store().celebratedReplyId).toBe(REPLY_ID)

			store().revealReply(null)
			expect(store().celebratedReplyId).toBeNull()
		})

		it('is atomic: the second consume returns nothing', () => {
			detect()

			expect(store().consume({ userId: USER_A, today: TODAY, now: T0 })).not.toBeNull()
			expect(store().consume({ userId: USER_A, today: TODAY, now: T0 })).toBeNull()
		})

		it('still celebrates at exactly the TTL and no longer a millisecond later', () => {
			detect()
			expect(
				store().consume({ userId: USER_A, today: TODAY, now: T0 + GOAL_PENDING_TTL_MS }),
			).not.toBeNull()

			useGoalCelebrationStore.setState({ celebratedReplyId: null })
			detect()
			expect(
				store().consume({ userId: USER_B, today: TODAY, now: T0 + GOAL_PENDING_TTL_MS + 1 }),
			).toBeNull()
		})

		it('drops a late event without a flag and does not replay it', () => {
			detect()

			const late = store().consume({
				userId: USER_A,
				today: TODAY,
				now: T0 + GOAL_PENDING_TTL_MS + 1,
			})

			expect(late).toBeNull()
			expect(store().pending).toBeNull()
			expect(hasCelebratedGoal(USER_A, TODAY)).toBe(false)
			expect(store().celebratedReplyId).toBeNull()
			expect(store().consume({ userId: USER_A, today: TODAY, now: T0 })).toBeNull()
		})

		it('works with the fake clock when no time is passed', () => {
			vi.useFakeTimers()
			vi.setSystemTime(T0)
			store().arm(REPLY_ID)
			store().setPending(TODAY)

			vi.advanceTimersByTime(GOAL_PENDING_TTL_MS + 1)

			expect(store().consume({ userId: USER_A, today: TODAY })).toBeNull()
			expect(hasCelebratedGoal(USER_A, TODAY)).toBe(false)
		})

		it('drops an event of yesterday after midnight, without a flag', () => {
			detect()

			expect(store().consume({ userId: USER_A, today: '2026-10-13', now: T0 })).toBeNull()
			expect(store().pending).toBeNull()
			expect(hasCelebratedGoal(USER_A, TODAY)).toBe(false)
			expect(hasCelebratedGoal(USER_A, '2026-10-13')).toBe(false)
		})

		it('drops the event when the day was already celebrated', () => {
			markGoalCelebrated(USER_A, TODAY)
			detect()

			expect(store().consume({ userId: USER_A, today: TODAY, now: T0 })).toBeNull()
			expect(store().pending).toBeNull()
			expect(store().celebratedReplyId).toBeNull()
		})

		it('carries a quiet arming (an achievement came with the reply) into the event', () => {
			store().arm(REPLY_ID, { isQuiet: true, now: T0 })
			store().setPending(TODAY, T0)

			expect(store().consume({ userId: USER_A, today: TODAY, now: T0 })).toEqual({
				localDate: TODAY,
				messageId: REPLY_ID,
				detectedAt: T0,
				isQuiet: true,
			})
		})

		it('has no reply for an edit (armed without a message)', () => {
			detect(null)

			expect(store().consume({ userId: USER_A, today: TODAY, now: T0 })).toEqual({
				localDate: TODAY,
				messageId: null,
				detectedAt: T0,
				isQuiet: false,
			})
			expect(store().celebratedReplyId).toBeNull()
		})
	})

	describe('restorePending', () => {
		const event = { localDate: TODAY, messageId: REPLY_ID, detectedAt: T0, isQuiet: false }

		it('puts the event back as pending with its original detectedAt', () => {
			store().restorePending(event)

			expect(store().pending).toEqual({
				localDate: TODAY,
				messageId: REPLY_ID,
				detectedAt: T0,
				isQuiet: false,
			})
		})

		it('does nothing when a newer event is already pending', () => {
			store().arm(null, { now: T0 + 500 })
			store().setPending('2026-10-13', T0 + 500)
			const before = store().pending

			store().restorePending(event)

			expect(store().pending).toEqual(before)
		})

		it('ages from the detection: a restored stale event is dropped by consume without a flag', () => {
			store().restorePending(event)

			const result = store().consume({
				userId: USER_A,
				today: TODAY,
				now: T0 + GOAL_PENDING_TTL_MS + 1,
			})

			expect(result).toBeNull()
			expect(store().pending).toBeNull()
			expect(hasCelebratedGoal(USER_A, TODAY)).toBe(false)
		})

		it('a restored fresh event is consumed again, still without a flag', () => {
			store().restorePending(event)

			expect(store().consume({ userId: USER_A, today: TODAY, now: T0 + 1000 })).toEqual(event)
			expect(hasCelebratedGoal(USER_A, TODAY)).toBe(false)
		})
	})

	describe('claim', () => {
		const fill = (): void => {
			store().arm(REPLY_ID, { now: Date.now() })
			useGoalCelebrationStore.setState({
				pending: { localDate: TODAY, messageId: REPLY_ID, detectedAt: T0, isQuiet: false },
				celebratedReplyId: REPLY_ID,
			})
		}

		it('resets the state and clears the previous user flags for another user', () => {
			store().claim(USER_A)
			markGoalCelebrated(USER_A, TODAY)
			markGoalCelebrated(USER_B, TODAY)
			fill()

			store().claim(USER_B)

			expect(store()).toMatchObject({
				ownerId: USER_B,
				armed: null,
				pending: null,
				celebratedReplyId: null,
			})
			expect(hasCelebratedGoal(USER_A, TODAY)).toBe(false)
			expect(hasCelebratedGoal(USER_B, TODAY)).toBe(true)
		})

		it('clears the flags on logout as well', () => {
			store().claim(USER_A)
			markGoalCelebrated(USER_A, TODAY)

			store().claim(null)

			expect(store().ownerId).toBeNull()
			expect(hasCelebratedGoal(USER_A, TODAY)).toBe(false)
		})

		it('keeps the flags on the first claim after a page load (null to user)', () => {
			markGoalCelebrated(USER_A, TODAY)
			fill()

			store().claim(USER_A)

			expect(store().ownerId).toBe(USER_A)
			expect(hasCelebratedGoal(USER_A, TODAY)).toBe(true)
		})

		it('changes nothing for the same user', () => {
			store().claim(USER_A)
			markGoalCelebrated(USER_A, TODAY)
			fill()
			const before = store()

			store().claim(USER_A)

			expect(store().armed).toEqual(before.armed)
			expect(store().pending).toEqual(before.pending)
			expect(store().celebratedReplyId).toBe(REPLY_ID)
			expect(hasCelebratedGoal(USER_A, TODAY)).toBe(true)
		})
	})
})
