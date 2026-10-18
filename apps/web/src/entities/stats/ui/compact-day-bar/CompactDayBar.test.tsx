// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { CompactDayBar } from './CompactDayBar'

afterEach(cleanup)

const PROTEIN = { value: 78, goal: 140 }

describe('CompactDayBar as an expand button', () => {
	it('keeps the field focus: mousedown default is prevented', () => {
		renderWithProviders(
			<CompactDayBar eaten={1370} goal={2200} protein={PROTEIN} onExpand={vi.fn()} />,
		)

		expect(fireEvent.mouseDown(screen.getByRole('button'))).toBe(false)
	})

	// iOS/WebKit: preventDefault on pointerdown swallows the click of a touch tap
	it('does not cancel pointerdown', () => {
		renderWithProviders(
			<CompactDayBar eaten={1370} goal={2200} protein={PROTEIN} onExpand={vi.fn()} />,
		)

		expect(fireEvent.pointerDown(screen.getByRole('button'))).toBe(true)
	})

	it('calls onExpand on click', () => {
		const onExpand = vi.fn()
		renderWithProviders(
			<CompactDayBar eaten={1370} goal={2200} protein={PROTEIN} onExpand={onExpand} />,
		)

		fireEvent.click(screen.getByRole('button'))

		expect(onExpand).toHaveBeenCalledTimes(1)
	})
})
