// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createWrapper, renderWithProviders } from '@/shared/testing'

import { ReorderHandle } from './ReorderHandle'

afterEach(cleanup)

const LABEL = 'Перетягнути: Жим'

const getHandle = (): HTMLElement => screen.getByRole('button', { name: LABEL })

describe('ReorderHandle', () => {
	it('ArrowUp and ArrowDown call onMove with the step', () => {
		const onMove = vi.fn(() => true)
		renderWithProviders(<ReorderHandle label={LABEL} index={1} onMove={onMove} />)

		fireEvent.keyDown(getHandle(), { key: 'ArrowUp' })
		fireEvent.keyDown(getHandle(), { key: 'ArrowDown' })
		fireEvent.keyDown(getHandle(), { key: 'Enter' })

		expect(onMove.mock.calls).toEqual([[-1], [1]])
		expect(getHandle().getAttribute('aria-keyshortcuts')).toBe('ArrowUp ArrowDown')
	})

	it('has no drag classes and starts nothing without onPointerDown', () => {
		renderWithProviders(<ReorderHandle label={LABEL} index={0} onMove={() => true} />)

		const { className } = getHandle()
		expect(className).not.toContain('touch-none')
		expect(className).not.toContain('cursor-grab')
		expect(() => fireEvent.pointerDown(getHandle())).not.toThrow()
	})

	it('with onPointerDown it has the drag classes and calls it', () => {
		const onPointerDown = vi.fn()
		renderWithProviders(
			<ReorderHandle label={LABEL} index={0} onMove={() => true} onPointerDown={onPointerDown} />,
		)

		expect(getHandle().className).toContain('touch-none')
		expect(getHandle().className).toContain('cursor-grab')
		fireEvent.pointerDown(getHandle())
		expect(onPointerDown).toHaveBeenCalledTimes(1)
	})

	it('brings the focus back after the index changes', () => {
		const onMove = vi.fn(() => true)
		const { rerender } = render(<ReorderHandle label={LABEL} index={1} onMove={onMove} />, {
			wrapper: createWrapper(),
		})

		fireEvent.keyDown(getHandle(), { key: 'ArrowUp' })
		rerender(<ReorderHandle label={LABEL} index={0} onMove={onMove} />)

		expect(document.activeElement).toBe(getHandle())
	})

	it('does not take the focus when the move was refused', () => {
		const onMove = vi.fn(() => false)
		const { rerender } = render(<ReorderHandle label={LABEL} index={0} onMove={onMove} />, {
			wrapper: createWrapper(),
		})

		fireEvent.keyDown(getHandle(), { key: 'ArrowUp' })
		rerender(<ReorderHandle label={LABEL} index={1} onMove={onMove} />)

		expect(document.activeElement).not.toBe(getHandle())
	})
})
