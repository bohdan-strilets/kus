// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { StepValue } from './StepValue'

afterEach(cleanup)

describe('StepValue', () => {
	it('shows the first text at once, without the entering state', () => {
		const { container } = render(<StepValue text="50" direction={1} />)

		expect(screen.getByText('50')).toBeTruthy()
		expect(container.querySelector('span span')?.getAttribute('style') ?? '').not.toContain(
			'opacity: 0',
		)
	})

	it('a changed value shows the new number; the old one is hidden from assistive tech while it leaves', async () => {
		const { rerender } = render(<StepValue text="50" direction={1} />)

		rerender(<StepValue text="52,5" direction={1} />)

		expect(screen.getByText('52,5').getAttribute('aria-hidden')).toBeNull()
		expect(screen.getByText('50').getAttribute('aria-hidden')).toBe('true')
		await waitFor(() => {
			expect(screen.queryByText('50')).toBeNull()
		})
	})

	it('goes down with direction -1 too', async () => {
		const { container, rerender } = render(<StepValue text="9" direction={-1} />)

		rerender(<StepValue text="8" direction={-1} />)

		await waitFor(() => {
			expect(container.textContent).toBe('8')
		})
	})

	it('direction 0 is a plain crossfade (a renumbered label)', async () => {
		const { container, rerender } = render(<StepValue text="3" direction={0} />)

		rerender(<StepValue text="2" direction={0} />)

		await waitFor(() => {
			expect(container.textContent).toBe('2')
		})
	})
})
