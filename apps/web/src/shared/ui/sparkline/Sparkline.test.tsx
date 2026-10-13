// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Sparkline } from './Sparkline'

afterEach(cleanup)

describe('Sparkline', () => {
	it('is an image with the given name', () => {
		render(<Sparkline values={[84, 83, 82.4]} label="Вага за 5 тижнів" />)

		expect(screen.getByRole('img', { name: 'Вага за 5 тижнів' })).toBeTruthy()
	})

	it('draws the fill and the line for several points', () => {
		const { container } = render(<Sparkline values={[84, 83, 82.4]} label="x" />)

		expect(container.querySelectorAll('path')).toHaveLength(2)
		expect(container.querySelector('[data-sparkline-dot]')).toBeNull()
	})

	it('draws only a round dot, no line, for one point', () => {
		const { container } = render(<Sparkline values={[82.4]} label="x" />)

		expect(container.querySelector('path')).toBeNull()
		// the dot lives outside the stretched SVG, with a fixed square size: it cannot become an oval
		expect(container.querySelector('svg circle')).toBeNull()
		const dot = container.querySelector('[data-sparkline-dot]')
		expect(dot?.className).toContain('size-2')
		expect(dot?.className).toContain('rounded-full')
		expect((dot as HTMLElement).style.left).toContain('96.29')
	})

	it('draws nothing for no values', () => {
		const { container } = render(<Sparkline values={[]} label="x" />)

		expect(container.firstChild).toBeNull()
	})

	it('draws a dashed goal line only when a reference is given and close', () => {
		const { container, rerender } = render(<Sparkline values={[84, 83, 82]} label="x" />)
		expect(container.querySelector('line')).toBeNull()

		rerender(<Sparkline values={[84, 83, 82]} label="x" reference={81} />)
		expect(container.querySelector('line')?.getAttribute('stroke-dasharray')).toBe('4 4')
	})
})
