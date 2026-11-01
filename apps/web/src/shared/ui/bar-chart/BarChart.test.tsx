// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BarChart } from './BarChart'

afterEach(cleanup)

const BARS = [
	{ label: '22.09', value: 2 },
	{ label: '29.09', value: 0 },
	{ label: '6.10', value: 4 },
]

describe('BarChart', () => {
	it('is one image with the summary and draws a stub for zero', () => {
		const { container } = render(<BarChart bars={BARS} summary="Тренувань на тиждень" />)

		expect(screen.getByRole('img', { name: 'Тренувань на тиждень' })).toBeTruthy()
		expect(container.querySelectorAll('[data-bar-stub]')).toHaveLength(1)
	})

	it('scales bars to the tallest', () => {
		const { container } = render(<BarChart bars={BARS} summary="x" />)

		const heights = [...container.querySelectorAll<HTMLElement>('span[style]')].map(
			(bar) => bar.style.height,
		)
		expect(heights).toEqual(['44px', '88px'])
	})

	it('above the threshold drops the value captions and keeps them in the hidden list', () => {
		const many = Array.from({ length: 13 }, (_, index) => ({
			label: `${index + 1}.10`,
			value: index + 1,
		}))
		const { container } = render(<BarChart bars={many} listLabel="Тижні" />)

		expect(container.querySelectorAll('.tabular-nums')).toHaveLength(0)
		expect(container.querySelectorAll('.invisible')).toHaveLength(13 - 5)
		expect(screen.getByRole('list', { name: 'Тижні' }).children[12]?.textContent).toBe('13.10: 13')
	})

	it('without a summary reads the bars from a hidden list', () => {
		render(<BarChart bars={BARS} listLabel="Тижні" />)

		expect(screen.getByRole('list', { name: 'Тижні' }).children).toHaveLength(3)
	})
})
