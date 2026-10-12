// @vitest-environment jsdom
import type { ChatMessage } from '@kus/shared'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useFreshReplyStore, useIsFreshMeal } from './fresh-reply-store'

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
		useFreshReplyStore.setState({ ownerId: null, mealIds: {} })
	})

	it('marks every meal of the reply as fresh', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1', 'm2']))

		expect(useFreshReplyStore.getState().mealIds).toEqual({ m1: true, m2: true })
	})

	it('keeps earlier marks when another reply arrives', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']))
		useFreshReplyStore.getState().markFresh(reply(['m2']))

		expect(Object.keys(useFreshReplyStore.getState().mealIds).sort()).toEqual(['m1', 'm2'])
	})

	it('adds nothing for a reply without meals', () => {
		const before = useFreshReplyStore.getState().mealIds

		useFreshReplyStore.getState().markFresh(reply([]))

		expect(useFreshReplyStore.getState().mealIds).toBe(before)
		expect(before).toEqual({})
	})

	it('releases only the given meal', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1', 'm2']))

		useFreshReplyStore.getState().release('m1')

		expect(useFreshReplyStore.getState().mealIds).toEqual({ m2: true })
	})

	it('ignores releasing an unknown meal', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']))
		const before = useFreshReplyStore.getState().mealIds

		useFreshReplyStore.getState().release('unknown')

		expect(useFreshReplyStore.getState().mealIds).toBe(before)
	})

	it('drops the marks when another user claims the store, and after logout', () => {
		useFreshReplyStore.getState().claim(USER_A)
		useFreshReplyStore.getState().markFresh(reply(['m1']))

		useFreshReplyStore.getState().claim(USER_B)
		expect(useFreshReplyStore.getState()).toMatchObject({ ownerId: USER_B, mealIds: {} })

		useFreshReplyStore.getState().markFresh(reply(['m2']))
		useFreshReplyStore.getState().claim(null)
		expect(useFreshReplyStore.getState()).toMatchObject({ ownerId: null, mealIds: {} })
	})

	it('keeps the marks when the same user claims again', () => {
		useFreshReplyStore.getState().claim(USER_A)
		useFreshReplyStore.getState().markFresh(reply(['m1']))

		useFreshReplyStore.getState().claim(USER_A)

		expect(useFreshReplyStore.getState().mealIds).toEqual({ m1: true })
	})
})

describe('useIsFreshMeal', () => {
	beforeEach(() => {
		useFreshReplyStore.setState({ ownerId: null, mealIds: {} })
	})

	it('is true for a fresh meal, false for others, and follows release', () => {
		useFreshReplyStore.getState().markFresh(reply(['m1']))
		const fresh = renderHook(() => useIsFreshMeal('m1'))
		const other = renderHook(() => useIsFreshMeal('m2'))

		expect(fresh.result.current).toBe(true)
		expect(other.result.current).toBe(false)

		act(() => {
			useFreshReplyStore.getState().release('m1')
		})

		expect(fresh.result.current).toBe(false)
	})

	it('turns true when the meal is marked after the first render', () => {
		const { result } = renderHook(() => useIsFreshMeal('m1'))
		expect(result.current).toBe(false)

		act(() => {
			useFreshReplyStore.getState().markFresh(reply(['m1']))
		})

		expect(result.current).toBe(true)
	})
})
