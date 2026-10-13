// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { RangeToggle } from './RangeToggle'

afterEach(cleanup)

describe('RangeToggle', () => {
	it('offers 7, 30 and 90 days as a group and presses only the selected one', () => {
		renderWithProviders(<RangeToggle value={30} onChange={vi.fn()} />)

		const buttons = screen.getAllByRole('button')

		expect(screen.getByRole('group')).toBeTruthy()
		expect(buttons).toHaveLength(3)
		expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual([
			'false',
			'true',
			'false',
		])
	})

	it('reports the chosen range', () => {
		const onChange = vi.fn()
		renderWithProviders(<RangeToggle value={7} onChange={onChange} />)

		const [, month, quarter] = screen.getAllByRole('button')
		fireEvent.click(quarter as HTMLElement)
		fireEvent.click(month as HTMLElement)

		expect(onChange.mock.calls).toEqual([[90], [30]])
	})
})
