// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useEnteringKeys } from './use-entering-keys'

const renderKeys = (initial: string[]) =>
	renderHook(({ keys }) => useEnteringKeys(keys), { initialProps: { keys: initial } })

describe('useEnteringKeys', () => {
	it('the keys there from the start are not new', () => {
		const { result } = renderKeys(['a', 'b'])

		expect([...result.current]).toEqual([])
	})

	it('an empty list at the start: everything that comes later is new', () => {
		const { result, rerender } = renderKeys([])

		rerender({ keys: ['a'] })

		expect([...result.current]).toEqual(['a'])
	})

	it('a key added later is new, the old ones stay not new', () => {
		const { result, rerender } = renderKeys(['a', 'b'])

		rerender({ keys: ['a', 'b', 'c'] })

		expect([...result.current]).toEqual(['c'])
	})

	it('a key that left and came back (undo) is new again', () => {
		const { result, rerender } = renderKeys(['a', 'b'])

		rerender({ keys: ['a'] })
		expect([...result.current]).toEqual([])

		rerender({ keys: ['a', 'b'] })
		expect([...result.current]).toEqual(['b'])
	})

	it('a key that was added stays known on later renders with the same list', () => {
		const { result, rerender } = renderKeys(['a'])

		rerender({ keys: ['a', 'b'] })
		rerender({ keys: ['a', 'b'] })

		expect([...result.current]).toEqual(['b'])
	})
})
