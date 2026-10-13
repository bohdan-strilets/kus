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
		expect(container.querySelector('circle')).toBeNull()
	})

	it('draws only a dot, no line, for one point', () => {
		const { container } = render(<Sparkline values={[82.4]} label="x" />)

		expect(container.querySelector('path')).toBeNull()
		expect(container.querySelectorAll('circle')).toHaveLength(1)
	})

	it('draws nothing for no values', () => {
		const { container } = render(<Sparkline values={[]} label="x" />)

		expect(container.firstChild).toBeNull()
	})
})
