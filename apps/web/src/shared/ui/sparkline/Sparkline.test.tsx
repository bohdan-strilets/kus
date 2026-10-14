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

	it('captions the first and the latest value and rings the end dot', () => {
		const { container } = render(
			<Sparkline
				values={[84, 83, 82.4]}
				label="x"
				marks={{ first: '84,0', last: '82,4', endDot: 'lg' }}
			/>,
		)

		expect(screen.getByText('84,0')).toBeTruthy()
		expect(screen.getByText('82,4').className).toContain('font-bold')
		const dot = container.querySelector('[data-sparkline-end-dot]') as HTMLElement
		expect(dot.className).toContain('size-3')
		expect(dot.className).toContain('ring-white')
		expect(dot.style.left).toContain('96.29')
	})

	it('places the captions above their points, not on the line', () => {
		const { container } = render(
			<Sparkline values={[84, 83, 82.4]} label="x" marks={{ first: '84,0', last: '82,4' }} />,
		)

		const first = container.querySelector('[data-sparkline-first]') as HTMLElement
		const last = container.querySelector('[data-sparkline-last]') as HTMLElement
		// anchored to the point and lifted above it by their own bottom padding
		expect(first.className).toContain('-translate-y-full')
		expect(first.className).toContain('pb-1.5')
		expect(first.style.left).toContain('3.7')
		expect(first.style.top).toContain('17.5')
		expect(last.className).toContain('-translate-y-full')
		expect(last.className).toContain('pb-3')
		expect(last.style.top).toContain('82.5')
	})

	it('uses a smaller end dot for sm', () => {
		const { container } = render(<Sparkline values={[96, 94]} label="x" marks={{ endDot: 'sm' }} />)

		expect(container.querySelector('[data-sparkline-end-dot]')?.className).toContain('size-2.5')
	})

	it('for one point shows one dot and only the latest caption', () => {
		const { container } = render(
			<Sparkline values={[82.4]} label="x" marks={{ first: '82,4', last: '82,4', endDot: 'lg' }} />,
		)

		expect(container.querySelector('[data-sparkline-dot]')).toBeNull()
		expect(container.querySelectorAll('[data-sparkline-end-dot]')).toHaveLength(1)
		expect(screen.getAllByText('82,4')).toHaveLength(1)
	})

	it('without marks draws no captions and no end dot', () => {
		const { container } = render(<Sparkline values={[84, 83, 82.4]} label="x" />)

		expect(container.querySelector('[data-sparkline-end-dot]')).toBeNull()
		expect(container.querySelector('[data-sparkline-first]')).toBeNull()
		expect(container.querySelector('[data-sparkline-last]')).toBeNull()
	})

	it('draws a dashed goal line only when a reference is given and close', () => {
		const { container, rerender } = render(<Sparkline values={[84, 83, 82]} label="x" />)
		expect(container.querySelector('line')).toBeNull()

		rerender(<Sparkline values={[84, 83, 82]} label="x" reference={81} />)
		expect(container.querySelector('line')?.getAttribute('stroke-dasharray')).toBe('4 4')
	})
})
