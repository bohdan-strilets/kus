// @vitest-environment jsdom
import { act, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderHookWithProviders } from '@/shared/testing'

import { useReorderAnnouncement } from './use-reorder-announcement'

afterEach(cleanup)

const renderReorder = () => {
	const onMove = vi.fn()
	const items = [{ name: 'Жим' }, { name: 'Присід' }, { name: 'Тяга' }]
	const hook = renderHookWithProviders(() =>
		useReorderAnnouncement({ items, getName: (item) => item.name, onMove }),
	)
	return { ...hook, onMove }
}

describe('useReorderAnnouncement', () => {
	it('moves, calls onMove and announces the new position', () => {
		const { result, onMove } = renderReorder()

		let isMoved = false
		act(() => {
			isMoved = result.current.move(1, -1)
		})

		expect(isMoved).toBe(true)
		expect(onMove).toHaveBeenCalledWith(1, -1)
		expect(result.current.announcement).toBe('Присід: позиція 1 з 3')
	})

	it('refuses a move past the edges without calling onMove', () => {
		const { result, onMove } = renderReorder()

		let isUp = true
		let isDown = true
		act(() => {
			isUp = result.current.move(0, -1)
			isDown = result.current.move(2, 1)
		})

		expect(isUp).toBe(false)
		expect(isDown).toBe(false)
		expect(onMove).not.toHaveBeenCalled()
		expect(result.current.announcement).toBe('')
	})

	it('refuses an index that is not in the list', () => {
		const { result, onMove } = renderReorder()

		let isMoved = true
		act(() => {
			isMoved = result.current.move(5, -1)
		})

		expect(isMoved).toBe(false)
		expect(onMove).not.toHaveBeenCalled()
	})
})
