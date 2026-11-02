// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import type { WeekDay } from './food-week-strip.types'
import { FoodWeekStrip, type FoodWeekStripProps } from './FoodWeekStrip'

const DAYS: WeekDay[] = [
	{ date: new Date(2026, 9, 18), status: 'normal' },
	{ date: new Date(2026, 9, 19), status: 'planned', isUpcoming: true },
	{ date: new Date(2026, 9, 20), status: 'empty', isUpcoming: true },
]

const noop = (): undefined => undefined

const makeProps = (selectedDate: Date): FoodWeekStripProps => ({
	days: DAYS,
	selectedDate,
	today: selectedDate,
	onSelect: noop,
	onSwipePrev: noop,
	onSwipeNext: noop,
	canGoNext: true,
})

afterEach(cleanup)

describe('FoodWeekStrip upcoming days', () => {
	it('names a planned day and an empty upcoming one without «без записів»', () => {
		renderWithProviders(<FoodWeekStrip {...makeProps(new Date(2026, 9, 18))} />)

		expect(screen.getByRole('button', { name: /— заплановано$/ })).toBeTruthy()
		expect(screen.getByRole('button', { name: /— нічого не записано$/ })).toBeTruthy()
		expect(screen.queryByRole('button', { name: /без записів/ })).toBeNull()
	})

	it('the chosen empty day has no dot, the chosen planned one a ring', () => {
		const { container, rerender } = renderWithProviders(
			<FoodWeekStrip {...makeProps(new Date(2026, 9, 20))} />,
		)
		const getSelectedDot = (): Element | null =>
			container.querySelector('[aria-current="date"] span:last-child > span')

		expect(getSelectedDot()?.className).toContain('bg-transparent')
		expect(getSelectedDot()?.className).not.toContain('bg-white')

		rerender(<FoodWeekStrip {...makeProps(new Date(2026, 9, 19))} />)
		expect(getSelectedDot()?.className).toContain('border-white')
	})
})
