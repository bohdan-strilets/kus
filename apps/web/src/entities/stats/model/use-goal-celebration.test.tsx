// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { animate } from 'motion'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { burst, CELEBRATE, isReducedMotion, playSound, RING_FILL_MS } from '@/shared/lib'

import { hasCelebratedGoal } from '../lib/goal-celebrated-flag'
import { GOAL_PENDING_TTL_MS, useGoalCelebrationStore } from './goal-celebration-store'
import { GOAL_AFTER_KUSIK_MS, useGoalCelebration } from './use-goal-celebration'

vi.mock('motion', () => ({ animate: vi.fn() }))
vi.mock('@/shared/lib', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	playSound: vi.fn(),
	burst: vi.fn(),
	isReducedMotion: vi.fn(),
}))

const USER = '0199b3a4-0000-7000-8000-00000000000a'
const TODAY = '2026-10-12'
const OTHER_DAY = '2026-10-11'
const REPLY_ID = '0199b3a4-0000-7000-8000-000000000011'
const T0 = 1_700_000_000_000
const DISTANCE = 40

const store = () => useGoalCelebrationStore.getState()

interface Refs {
	hostRef: { current: HTMLElement | null }
	originRef: { current: Element | null }
	glowRef: { current: HTMLElement | null }
}

const createRefs = (): Refs => ({
	hostRef: { current: document.createElement('div') },
	originRef: { current: document.createElement('div') },
	glowRef: { current: document.createElement('span') },
})

const renderCelebration = (refs: Refs = createRefs()) => ({
	refs,
	...renderHook(() => {
		useGoalCelebration({ userId: USER, today: TODAY, ...refs, particleDistance: DISTANCE })
	}),
})

const advance = (ms: number) => {
	act(() => {
		vi.advanceTimersByTime(ms)
	})
}

const setPending = (localDate = TODAY, now = Date.now()) => {
	act(() => {
		store().arm(REPLY_ID, now)
		store().setPending(localDate, now)
	})
}

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(T0)
	localStorage.clear()
	vi.mocked(isReducedMotion).mockReturnValue(false)
	useGoalCelebrationStore.setState({
		ownerId: null,
		armed: null,
		pending: null,
		celebratedReplyId: null,
	})
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	vi.useRealTimers()
})

describe('useGoalCelebration', () => {
	it('consumes the event at once but marks the day and plays everything only after the ring has filled', () => {
		const { refs } = renderCelebration()
		setPending()

		expect(store().pending).toBeNull()
		advance(RING_FILL_MS - 1)
		expect(hasCelebratedGoal(USER, TODAY)).toBe(false)
		expect(playSound).not.toHaveBeenCalled()
		expect(store().celebratedReplyId).toBeNull()

		advance(1)
		expect(hasCelebratedGoal(USER, TODAY)).toBe(true)
		expect(playSound).toHaveBeenCalledTimes(1)
		expect(playSound).toHaveBeenCalledWith('goal')
		expect(burst).toHaveBeenCalledTimes(1)
		expect(burst).toHaveBeenCalledWith(refs.hostRef.current, refs.originRef.current, {
			...CELEBRATE.goal,
			distance: DISTANCE,
		})
		expect(animate).toHaveBeenCalledTimes(1)
		expect(vi.mocked(animate).mock.calls[0]?.[0]).toBe(refs.glowRef.current)
		expect(vi.mocked(animate).mock.calls[0]?.[1]).toMatchObject({
			opacity: [0, expect.any(Number), 0],
			scale: [1, expect.any(Number), 1],
		})
		expect(store().celebratedReplyId).toBe(REPLY_ID)
	})

	it('under reduced motion plays the sound after the kusik pause without particles or glow', () => {
		vi.mocked(isReducedMotion).mockReturnValue(true)
		renderCelebration()
		setPending()

		advance(GOAL_AFTER_KUSIK_MS - 1)
		expect(playSound).not.toHaveBeenCalled()

		advance(1)
		expect(playSound).toHaveBeenCalledTimes(1)
		expect(playSound).toHaveBeenCalledWith('goal')
		expect(burst).not.toHaveBeenCalled()
		expect(animate).not.toHaveBeenCalled()
		expect(store().celebratedReplyId).toBe(REPLY_ID)
	})

	it('does not celebrate a stale pending goal and writes no flag', () => {
		renderCelebration()
		setPending(TODAY, T0 - GOAL_PENDING_TTL_MS - 1)

		advance(RING_FILL_MS * 2)
		expect(playSound).not.toHaveBeenCalled()
		expect(hasCelebratedGoal(USER, TODAY)).toBe(false)
		expect(store().pending).toBeNull()
	})

	it('does not celebrate a goal of another date', () => {
		renderCelebration()
		setPending(OTHER_DAY)

		advance(RING_FILL_MS * 2)
		expect(playSound).not.toHaveBeenCalled()
		expect(burst).not.toHaveBeenCalled()
		expect(hasCelebratedGoal(USER, OTHER_DAY)).toBe(false)
		expect(hasCelebratedGoal(USER, TODAY)).toBe(false)
	})

	it('plays nothing when unmounted before the timer, and a later mount after the TTL does not replay it', () => {
		const { unmount } = renderCelebration()
		setPending()
		unmount()

		advance(GOAL_PENDING_TTL_MS + 1)
		expect(playSound).not.toHaveBeenCalled()
		expect(store().celebratedReplyId).toBeNull()
		expect(hasCelebratedGoal(USER, TODAY)).toBe(false)

		renderCelebration()
		advance(RING_FILL_MS * 2)
		expect(playSound).not.toHaveBeenCalled()
		expect(burst).not.toHaveBeenCalled()
	})

	it('celebrates once when two rings are mounted', () => {
		renderCelebration()
		renderCelebration()
		setPending()

		advance(RING_FILL_MS * 2)
		expect(playSound).toHaveBeenCalledTimes(1)
		expect(burst).toHaveBeenCalledTimes(1)
	})

	it('does not celebrate a day that is already flagged', () => {
		localStorage.setItem(`kusik-goal-celebrated:${USER}:${TODAY}`, '1')
		renderCelebration()
		setPending()

		advance(RING_FILL_MS * 2)
		expect(playSound).not.toHaveBeenCalled()
	})

	describe('unmount before the timer', () => {
		it('restores the pending event with its detectedAt, with no flag and no sound', () => {
			const { unmount } = renderCelebration()
			setPending()
			expect(store().pending).toBeNull()

			advance(RING_FILL_MS - 100)
			unmount()

			expect(store().pending).toEqual({ localDate: TODAY, messageId: REPLY_ID, detectedAt: T0 })
			expect(hasCelebratedGoal(USER, TODAY)).toBe(false)
			advance(RING_FILL_MS * 2)
			expect(playSound).not.toHaveBeenCalled()
			expect(store().celebratedReplyId).toBeNull()
		})

		it('a new ring mounted within the TTL plays the whole celebration once', () => {
			const first = renderCelebration()
			setPending()
			advance(300)
			first.unmount()

			const second = renderCelebration()
			expect(store().pending).toBeNull()
			advance(RING_FILL_MS - 1)
			expect(hasCelebratedGoal(USER, TODAY)).toBe(false)
			expect(playSound).not.toHaveBeenCalled()

			advance(1)
			expect(playSound).toHaveBeenCalledTimes(1)
			expect(playSound).toHaveBeenCalledWith('goal')
			expect(hasCelebratedGoal(USER, TODAY)).toBe(true)
			expect(burst).toHaveBeenCalledTimes(1)
			expect(burst).toHaveBeenCalledWith(
				second.refs.hostRef.current,
				second.refs.originRef.current,
				{ ...CELEBRATE.goal, distance: DISTANCE },
			)
			expect(store().celebratedReplyId).toBe(REPLY_ID)
		})

		it('a new ring mounted after the TTL plays nothing and writes no flag', () => {
			const first = renderCelebration()
			setPending()
			first.unmount()

			advance(GOAL_PENDING_TTL_MS + 1)
			renderCelebration()
			advance(RING_FILL_MS * 2)

			expect(playSound).not.toHaveBeenCalled()
			expect(burst).not.toHaveBeenCalled()
			expect(hasCelebratedGoal(USER, TODAY)).toBe(false)
			expect(store().pending).toBeNull()
		})
	})

	it('does not restore anything when unmounted after the timer has fired', () => {
		const { unmount } = renderCelebration()
		setPending()
		advance(RING_FILL_MS)
		expect(playSound).toHaveBeenCalledTimes(1)

		unmount()

		expect(store().pending).toBeNull()
		expect(hasCelebratedGoal(USER, TODAY)).toBe(true)
	})

	it('does not consume a pending goal without userId or today', () => {
		const refs = createRefs()
		renderHook(() => {
			useGoalCelebration({
				userId: undefined,
				today: undefined,
				...refs,
				particleDistance: DISTANCE,
			})
		})
		setPending()

		advance(RING_FILL_MS * 2)

		expect(store().pending).not.toBeNull()
		expect(playSound).not.toHaveBeenCalled()
		expect(hasCelebratedGoal(USER, TODAY)).toBe(false)
	})

	it('a second detection while the timer waits keeps the first timer and waits in the store', () => {
		renderCelebration()
		setPending()
		advance(300)
		setPending(TODAY, Date.now())
		expect(store().pending).not.toBeNull()

		advance(RING_FILL_MS - 300)

		expect(playSound).toHaveBeenCalledTimes(1)
		expect(burst).toHaveBeenCalledTimes(1)
		expect(hasCelebratedGoal(USER, TODAY)).toBe(true)
		advance(RING_FILL_MS * 2)
		expect(playSound).toHaveBeenCalledTimes(1)
	})

	it('in StrictMode an existing pending event is played exactly once', () => {
		act(() => {
			store().arm(REPLY_ID, T0)
			store().setPending(TODAY, T0)
		})
		const refs = createRefs()

		renderHook(
			() => {
				useGoalCelebration({ userId: USER, today: TODAY, ...refs, particleDistance: DISTANCE })
			},
			{ wrapper: StrictMode },
		)
		advance(RING_FILL_MS * 2)

		expect(playSound).toHaveBeenCalledTimes(1)
		expect(playSound).toHaveBeenCalledWith('goal')
		expect(burst).toHaveBeenCalledTimes(1)
		expect(hasCelebratedGoal(USER, TODAY)).toBe(true)
		expect(store().pending).toBeNull()
	})

	it('still celebrates when the visual refs are empty, skipping the visuals only', () => {
		const refs = createRefs()
		refs.glowRef.current = null
		refs.hostRef.current = null
		renderCelebration(refs)
		setPending()

		advance(RING_FILL_MS)
		expect(playSound).toHaveBeenCalledTimes(1)
		expect(burst).not.toHaveBeenCalled()
		expect(animate).not.toHaveBeenCalled()
	})
})
