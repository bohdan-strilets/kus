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
	it('draws a success bar per day with food and today as a dashed empty outline', () => {
		const { container } = render(<WeekBarsChart days={days} goalKcal={2200} today={TODAY} />)

		const classOf = (element: Element): string => element.getAttribute('class') ?? ''
		const bars = [...container.querySelectorAll('g > path:first-child')]
		expect(bars).toHaveLength(7)
		expect(bars.filter((bar) => classOf(bar).includes('fill-success'))).toHaveLength(6)
		const today = container.querySelector('path[data-today]')
		expect(classOf(today as Element)).toContain('fill-track')
		expect(today?.getAttribute('stroke-dasharray')).toBe('3 3')
		expect(today?.getAttribute('vector-effect')).toBe('non-scaling-stroke')
		expect(container.querySelector('path[class*="opacity"]')).toBeNull()
	})

	it('redraws the part of an over day above the goal solid, clipped at the goal line', () => {
		const { container } = render(<WeekBarsChart days={days} goalKcal={2200} today={TODAY} />)

		const caps = [...container.querySelectorAll('path[data-over-cap]')]
		expect(caps).toHaveLength(2)
		const clip = container.querySelector('clipPath')
		expect(clip?.id).toBeTruthy()
		for (const cap of caps) {
			expect(cap.getAttribute('class')).toBe('fill-over')
			expect(cap.getAttribute('clip-path')).toBe(`url(#${clip?.id})`)
			expect(cap.getAttribute('d')).toBe(cap.previousElementSibling?.getAttribute('d'))
		}
		expect(Number(clip?.querySelector('rect')?.getAttribute('height'))).toBeGreaterThan(0)
		expect(container.innerHTML).not.toContain('over-soft')
	})

	it('does not cap today even when it is over', () => {
		const overToday = days.map((day) =>
			day.localDate === TODAY ? { ...day, kcal: 2500, status: 'over' as const } : day,
		)
		const { container } = render(<WeekBarsChart days={overToday} goalKcal={2200} today={TODAY} />)

		expect(container.querySelectorAll('path[data-over-cap]')).toHaveLength(2)
	})

	it('labels the tallest day in over-ink when it passes the goal, today in muted', () => {
		render(<WeekBarsChart days={days} goalKcal={2200} today={TODAY} />)
		const plain = (text: string): string => text.replace(/s/g, ' ')

		expect(screen.getByText((text) => plain(text) === '2 420').className).toContain('text-over-ink')
		expect(screen.getByText((text) => plain(text) === '1 370').className).toContain('text-muted')
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
				name: (name) =>
					plain(name) ===
					'Калорії по днях: від 2 000 до 2 420, понад ціль 2 дні, сьогодні поки 1 370',
			}),
		).toBeTruthy()
		expect(screen.getByText((text) => plain(text) === '2 420')).toBeTruthy()
	})

	it('names the chart of a week without food', () => {
		const none = days.map((day) => ({ ...day, kcal: 0, proteinG: 0, status: 'empty' as const }))
		render(<WeekBarsChart days={none} goalKcal={2200} today={TODAY} />)

		expect(screen.getByRole('img', { name: 'Калорії по днях: записів ще немає' })).toBeTruthy()
	})
})
