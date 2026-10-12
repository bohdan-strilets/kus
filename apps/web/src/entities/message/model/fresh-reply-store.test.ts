// @vitest-environment jsdom
import type { ChatMessage } from '@kus/shared'
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FRESH_TTL_MS, useFreshReplyStore } from './fresh-reply-store'
import { useFreshOnMount } from './use-fresh-on-mount'

const USER_A = '0199b3a4-0000-7000-8000-00000000000a'
const USER_B = '0199b3a4-0000-7000-8000-00000000000b'

const reply = (mealIds: string[]): ChatMessage =>
	({
		id: '0199b3a4-0000-7000-8000-000000000011',
		role: 'ASSISTANT',
		meals: mealIds.map((id) => ({ id })),
		clarifications: [],
	}) as unknown as ChatMessage

describe('useFreshReplyStore', () => {
	beforeEach(() => {
		useFreshReplyStore.setState({ ownerId: null, freshAt: {} })
	})

	it('marks every meal of the reply as fresh', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1', 'm2']))

		expect(Object.keys(useFreshReplyStore.getState().freshAt).sort()).toEqual(['m1', 'm2'])
	})

	it('keeps earlier marks when another reply arrives', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']))
		useFreshReplyStore.getState().markFresh(reply(['m2']))

		expect(Object.keys(useFreshReplyStore.getState().freshAt).sort()).toEqual(['m1', 'm2'])
	})

	it('adds nothing for a reply without meals', () => {
		const before = useFreshReplyStore.getState().freshAt

		useFreshReplyStore.getState().markFresh(reply([]))

		expect(useFreshReplyStore.getState().freshAt).toBe(before)
		expect(before).toEqual({})
	})

	it('releases only the given meal', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1', 'm2']))

		useFreshReplyStore.getState().release('m1')

		expect(Object.keys(useFreshReplyStore.getState().freshAt)).toEqual(['m2'])
	})

	it('ignores releasing an unknown meal', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']))
		const before = useFreshReplyStore.getState().freshAt

		useFreshReplyStore.getState().release('unknown')

		expect(useFreshReplyStore.getState().freshAt).toBe(before)
	})

	it('drops the marks when another user claims the store, and after logout', () => {
		useFreshReplyStore.getState().claim(USER_A)
		useFreshReplyStore.getState().markFresh(reply(['m1']))

		useFreshReplyStore.getState().claim(USER_B)
		expect(useFreshReplyStore.getState()).toMatchObject({ ownerId: USER_B, freshAt: {} })

		useFreshReplyStore.getState().markFresh(reply(['m2']))
		useFreshReplyStore.getState().claim(null)
		expect(useFreshReplyStore.getState()).toMatchObject({ ownerId: null, freshAt: {} })
	})

	it('keeps the marks when the same user claims again', () => {
		useFreshReplyStore.getState().claim(USER_A)
		useFreshReplyStore.getState().markFresh(reply(['m1']))

		useFreshReplyStore.getState().claim(USER_A)

		expect(Object.keys(useFreshReplyStore.getState().freshAt)).toEqual(['m1'])
	})
})

describe('fresh reply TTL', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		useFreshReplyStore.setState({ ownerId: null, freshAt: {} })
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('is fresh at the moment of marking and up to the last ms before the TTL', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']))

		expect(useFreshReplyStore.getState().isFresh('m1')).toBe(true)
		vi.advanceTimersByTime(FRESH_TTL_MS - 1)
		expect(useFreshReplyStore.getState().isFresh('m1')).toBe(true)
	})

	it('is not fresh at exactly the TTL and later', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']))

		vi.advanceTimersByTime(FRESH_TTL_MS)
		expect(useFreshReplyStore.getState().isFresh('m1')).toBe(false)
		vi.advanceTimersByTime(60_000)
		expect(useFreshReplyStore.getState().isFresh('m1')).toBe(false)
	})

	it('is not fresh for an unknown meal or after release', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']))
		useFreshReplyStore.getState().release('m1')

		expect(useFreshReplyStore.getState().isFresh('m1')).toBe(false)
		expect(useFreshReplyStore.getState().isFresh('unknown')).toBe(false)
	})

	it('accepts an explicit now', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']), 1000)

		expect(useFreshReplyStore.getState().isFresh('m1', 1000 + FRESH_TTL_MS - 1)).toBe(true)
		expect(useFreshReplyStore.getState().isFresh('m1', 1000 + FRESH_TTL_MS)).toBe(false)
	})

	it('drops expired marks on the next write and keeps the alive ones', () => {
		useFreshReplyStore.getState().markFresh(reply(['old']))
		vi.advanceTimersByTime(FRESH_TTL_MS / 2)
		useFreshReplyStore.getState().markFresh(reply(['middle']))
		vi.advanceTimersByTime(FRESH_TTL_MS / 2)

		useFreshReplyStore.getState().markFresh(reply(['new']))

		expect(Object.keys(useFreshReplyStore.getState().freshAt).sort()).toEqual(['middle', 'new'])
	})

	it('re-marking a meal restarts its TTL', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']))
		vi.advanceTimersByTime(FRESH_TTL_MS - 1)
		useFreshReplyStore.getState().markFresh(reply(['m1']))
		vi.advanceTimersByTime(FRESH_TTL_MS - 1)

		expect(useFreshReplyStore.getState().isFresh('m1')).toBe(true)
	})
})

describe('useFreshOnMount', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		useFreshReplyStore.setState({ ownerId: null, freshAt: {} })
	})

	afterEach(() => {
		cleanup()
		vi.useRealTimers()
	})

	it('is true when the chat is entered within the TTL after the reply', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']))
		vi.advanceTimersByTime(FRESH_TTL_MS - 1)

		expect(renderHook(() => useFreshOnMount('m1')).result.current).toBe(true)
	})

	it('is false when the chat is entered after the TTL', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']))
		vi.advanceTimersByTime(FRESH_TTL_MS + 1)

		expect(renderHook(() => useFreshOnMount('m1')).result.current).toBe(false)
	})

	it('is false for another meal than the fresh one', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']))

		expect(renderHook(() => useFreshOnMount('m2')).result.current).toBe(false)
	})

	it('stays true after the TTL runs out while mounted', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']))
		const { result, rerender } = renderHook(() => useFreshOnMount('m1'))

		vi.advanceTimersByTime(FRESH_TTL_MS + 1)
		rerender()

		expect(result.current).toBe(true)
	})

	it('stays true after a release while mounted', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']))
		const { result, rerender } = renderHook(() => useFreshOnMount('m1'))

		useFreshReplyStore.getState().release('m1')
		rerender()

		expect(result.current).toBe(true)
	})

	it('stays false when the meal becomes fresh only after the mount', () => {
		const { result, rerender } = renderHook(() => useFreshOnMount('m1'))

		useFreshReplyStore.getState().markFresh(reply(['m1']))
		rerender()

		expect(result.current).toBe(false)
	})
})
