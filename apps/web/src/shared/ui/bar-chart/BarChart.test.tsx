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

	it('a pending bar has only its caption: no stub, no value, not in the hidden list', () => {
		const bars = [...BARS, { label: '13.10', value: 0, isPending: true }]
		const { container } = render(<BarChart bars={bars} listLabel="Тижні" />)

		expect(container.querySelectorAll('[data-bar-stub]')).toHaveLength(1)
		expect(container.querySelectorAll('.tabular-nums')).toHaveLength(3)
		expect(screen.getAllByText('13.10')).toHaveLength(1)
		expect(screen.getByRole('list', { name: 'Тижні' }).children).toHaveLength(3)
	})

	it('without a summary reads the bars from a hidden list', () => {
		render(<BarChart bars={BARS} listLabel="Тижні" />)

		expect(screen.getByRole('list', { name: 'Тижні' }).children).toHaveLength(3)
	})
})

describe('BarChart pending bar', () => {
	const bars = [
		{ label: 'пн', value: 3, ariaLabel: 'пн: 3' },
		{ label: 'вт', value: 0, ariaLabel: 'вт: 0', isPending: true },
	]

	it('keeps the caption but has no value, no stub and no entry in the hidden list', () => {
		const { container } = render(<BarChart bars={bars} listLabel="Дні" />)

		expect(screen.getByText('вт')).toBeTruthy()
		expect(container.querySelectorAll('[data-bar-stub]')).toHaveLength(0)
		const items = screen.getAllByRole('listitem').map((item) => item.textContent)
		expect(items).toEqual(['пн: 3'])
	})
})
