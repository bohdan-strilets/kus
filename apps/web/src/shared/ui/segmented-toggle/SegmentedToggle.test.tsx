// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SegmentedToggle } from './SegmentedToggle'

afterEach(cleanup)

const OPTIONS = [
	{ value: 'week', label: 'Тиждень' },
	{ value: 'month', label: 'Місяць', ariaLabel: 'Місяць, 30 днів' },
] as const

describe('SegmentedToggle', () => {
	it('is a named group and presses only the selected option', () => {
		render(
			<SegmentedToggle options={OPTIONS} value="month" onChange={vi.fn()} aria-label="Період" />,
		)

		expect(screen.getByRole('group', { name: 'Період' })).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Тиждень' }).getAttribute('aria-pressed')).toBe(
			'false',
		)
		expect(
			screen.getByRole('button', { name: 'Місяць, 30 днів' }).getAttribute('aria-pressed'),
		).toBe('true')
	})

	it('reports the chosen value with its own type', () => {
		const onChange = vi.fn()
		render(
			<SegmentedToggle options={OPTIONS} value="month" onChange={onChange} aria-label="Період" />,
		)

		fireEvent.click(screen.getByRole('button', { name: 'Тиждень' }))

		expect(onChange).toHaveBeenCalledWith('week')
	})
})
