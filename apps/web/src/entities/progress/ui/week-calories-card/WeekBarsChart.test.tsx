// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/shared/i18n'

import { makeProgress } from '@/shared/testing'
import { WeekBarsChart } from './WeekBarsChart'

const { days } = makeProgress().week
const TODAY = '2026-10-12'

afterEach(cleanup)

describe('WeekBarsChart', () => {
	it('draws a bar per day with food and makes only today paler', () => {
		const { container } = render(<WeekBarsChart days={days} goalKcal={2200} today={TODAY} />)

		const bars = container.querySelectorAll('path')
		expect(bars).toHaveLength(7)
		const pale = [...bars].filter((bar) => bar.classList.contains('opacity-35'))
		expect(pale).toHaveLength(1)
		expect(pale[0]?.getAttribute('data-today')).toBe('true')
	})

	it('colours an over day with the over family and the rest with primary', () => {
		const { container } = render(<WeekBarsChart days={days} goalKcal={2200} today={TODAY} />)

		const classes = [...container.querySelectorAll('path')].map((bar) => bar.getAttribute('class'))
		expect(classes.filter((value) => value?.includes('fill-over-soft'))).toHaveLength(2)
		expect(classes.filter((value) => value?.includes('fill-primary'))).toHaveLength(5)
	})

	it('draws the dashed goal line only with a goal', () => {
		const { container, rerender } = render(
			<WeekBarsChart days={days} goalKcal={2200} today={TODAY} />,
		)
		expect(container.querySelector('line[stroke-dasharray]')).not.toBeNull()

		rerender(<WeekBarsChart days={days} goalKcal={null} today={TODAY} />)
		expect(container.querySelector('line[stroke-dasharray]')).toBeNull()
	})

	it('describes the chart in words and labels the tallest day', () => {
		render(<WeekBarsChart days={days} goalKcal={2200} today={TODAY} />)

		// the Ukrainian thousands separator is a no-break space
		const plain = (text: string): string => text.replace(/\s/g, ' ')

		expect(
			screen.getByRole('img', {
				name: (name) => plain(name) === 'Калорії по днях: від 2 000 до 2 420, сьогодні поки 1 370',
			}),
		).toBeTruthy()
		expect(screen.getByText((text) => plain(text) === '2 420')).toBeTruthy()
	})
})
