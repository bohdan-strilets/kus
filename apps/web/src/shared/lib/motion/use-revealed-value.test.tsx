// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resetRevealedValues, useRevealedValue } from './use-revealed-value'

const KEY = 'calorie-gauge:large:fill'

beforeEach(() => {
	resetRevealedValues()
})

afterEach(() => {
	cleanup()
})

describe('useRevealedValue', () => {
	it('animates from 0 on the first show of the session', () => {
		const { result } = renderHook(() => useRevealedValue(KEY, 0.4))
		expect(result.current).toEqual({ from: 0, isAnimated: true })
	})

	it('shows the same value at once on a return to the screen', () => {
		const first = renderHook(() => useRevealedValue(KEY, 0.4))
		first.unmount()

		const again = renderHook(() => useRevealedValue(KEY, 0.4))
		expect(again.result.current).toEqual({ from: 0.4, isAnimated: false })
	})

	it('animates a changed value from the previous one, not from 0, after a remount', () => {
		const first = renderHook(() => useRevealedValue(KEY, 0.4))
		first.unmount()

		const again = renderHook(() => useRevealedValue(KEY, 0.7))
		expect(again.result.current).toEqual({ from: 0.4, isAnimated: true })
	})

	it('animates a new value while mounted from the one on screen', () => {
		const { result, rerender } = renderHook(({ value }) => useRevealedValue(KEY, value), {
			initialProps: { value: 0.4 },
		})

		act(() => {
			rerender({ value: 0.55 })
		})
		expect(result.current).toEqual({ from: 0.4, isAnimated: true })

		// a re-render with the same value keeps the result: effects that depend on it don't re-run
		const previous = result.current
		act(() => {
			rerender({ value: 0.55 })
		})
		expect(result.current).toBe(previous)
	})

	it('keeps every key apart', () => {
		const fill = renderHook(() => useRevealedValue(KEY, 0.4))
		fill.unmount()

		const number = renderHook(() => useRevealedValue('calorie-gauge:large:number', 1200))
		expect(number.result.current).toEqual({ from: 0, isAnimated: true })
	})

	it('always starts from 0 without a key', () => {
		const first = renderHook(() => useRevealedValue(null, 0.4))
		first.unmount()

		const again = renderHook(() => useRevealedValue(null, 0.4))
		expect(again.result.current).toEqual({ from: 0, isAnimated: true })
	})
})
