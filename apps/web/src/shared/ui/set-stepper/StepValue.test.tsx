// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { StepValue } from './StepValue'

afterEach(cleanup)

describe('StepValue', () => {
	it('shows the first text at once, without the entering state', () => {
		const { container } = render(<StepValue text="50" direction={1} />)

		expect(screen.getByText('50')).toBeTruthy()
		expect(container.querySelector('span')?.style.opacity).not.toBe('0')
	})

	it('a changed value shows the new number and only that one', () => {
		const { container, rerender } = render(
			<div aria-live="polite">
				<StepValue text="50" direction={1} />
			</div>,
		)

		rerender(
			<div aria-live="polite">
				<StepValue text="52,5" direction={1} />
			</div>,
		)

		expect(screen.getByText('52,5')).toBeTruthy()
		expect(screen.queryByText('50')).toBeNull()
		expect(container.querySelector('[aria-live]')?.textContent).toBe('52,5')
	})

	it('goes down with direction -1 too', () => {
		const { container, rerender } = render(<StepValue text="9" direction={-1} />)

		rerender(<StepValue text="8" direction={-1} />)

		expect(container.textContent).toBe('8')
	})
})
