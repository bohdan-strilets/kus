// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { SetDoneToggle } from './SetDoneToggle'

afterEach(cleanup)

describe('SetDoneToggle', () => {
	it('is a pressed toggle named by the set when done', () => {
		renderWithProviders(<SetDoneToggle label="2" isDone onToggle={vi.fn()} />)

		const button = screen.getByRole('button')

		expect(button.getAttribute('aria-pressed')).toBe('true')
		expect(button.getAttribute('aria-label')).toContain('2')
	})

	it('is not pressed when not done, and a tap toggles', () => {
		const onToggle = vi.fn()
		renderWithProviders(<SetDoneToggle label="1" isDone={false} onToggle={onToggle} />)

		const button = screen.getByRole('button')
		fireEvent.click(button)

		expect(button.getAttribute('aria-pressed')).toBe('false')
		expect(onToggle).toHaveBeenCalledTimes(1)
	})

	it('isPoppedOnMount on a done row keeps the same button, aria and check', () => {
		renderWithProviders(<SetDoneToggle label="3" isDone isPoppedOnMount onToggle={vi.fn()} />)

		const button = screen.getByRole('button')

		expect(button.getAttribute('aria-pressed')).toBe('true')
		expect(button.getAttribute('aria-label')).toContain('3')
		expect(button.querySelector('svg')).toBeTruthy()
	})

	it('isPoppedOnMount on a not-done row changes nothing', () => {
		renderWithProviders(
			<SetDoneToggle label="3" isDone={false} isPoppedOnMount onToggle={vi.fn()} />,
		)

		expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')
	})

	it('flipping to done keeps aria in step', () => {
		const { rerender } = renderWithProviders(
			<SetDoneToggle label="1" isDone={false} onToggle={vi.fn()} />,
		)

		rerender(<SetDoneToggle label="1" isDone onToggle={vi.fn()} />)

		expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
	})
})
