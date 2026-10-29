// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useIsOverlayOpen, useOverlayOpen, useOverlayStore } from './index'

const Overlay = ({ isOpen }: { isOpen: boolean }) => {
	useOverlayOpen(isOpen)
	return null
}

afterEach(() => {
	cleanup()
	useOverlayStore.setState({ count: 0 })
})

describe('useOverlayOpen', () => {
	it('counts an open sheet or dialog and forgets it when it closes', () => {
		const { result } = renderHook(() => useIsOverlayOpen())
		expect(result.current).toBe(false)

		const view = render(<Overlay isOpen />)
		expect(result.current).toBe(true)

		view.rerender(<Overlay isOpen={false} />)
		expect(result.current).toBe(false)
	})

	it('stays open while one of two stacked overlays is', () => {
		const { result } = renderHook(() => useIsOverlayOpen())
		const sheet = render(<Overlay isOpen />)
		const dialog = render(<Overlay isOpen />)
		expect(useOverlayStore.getState().count).toBe(2)

		dialog.unmount()
		expect(result.current).toBe(true)

		sheet.unmount()
		expect(result.current).toBe(false)
	})

	it('counts nothing for an overlay that never opened', () => {
		render(<Overlay isOpen={false} />)

		expect(useOverlayStore.getState().count).toBe(0)
	})

	it('never goes below zero', () => {
		act(() => {
			useOverlayStore.getState().close()
		})

		expect(useOverlayStore.getState().count).toBe(0)
	})
})
