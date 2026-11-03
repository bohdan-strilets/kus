// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
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
		expect(screen.getByRole('button', { name: /: ще попереду$/ })).toBeTruthy()
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

describe('FoodWeekStrip aria labels around today', () => {
	const TODAY = new Date(2026, 10, 3)
	const getLabels = (days: WeekDay[]): string[] => {
		renderWithProviders(
			<FoodWeekStrip {...makeProps(TODAY)} days={days} selectedDate={TODAY} today={TODAY} />,
		)
		return screen.getAllByRole('button').map((button) => button.getAttribute('aria-label') ?? '')
	}

	it('says «ще попереду» with the full day heading for an empty day after today', () => {
		getLabels([{ date: new Date(2026, 10, 5), status: 'empty', isUpcoming: true }])

		expect(screen.getByRole('button', { name: 'Четвер, 5 листопада: ще попереду' })).toBeTruthy()
	})

	it('keeps «день за програмою» wording for a planned day ahead', () => {
		getLabels([{ date: new Date(2026, 10, 5), status: 'planned', isUpcoming: true }])

		expect(screen.getByRole('button', { name: 'Четвер, 5 листопада — заплановано' })).toBeTruthy()
		expect(screen.queryByRole('button', { name: /ще попереду/ })).toBeNull()
	})

	it('keeps the food wording for today and the past days, empty ones included', () => {
		getLabels([
			{ date: new Date(2026, 10, 1), status: 'normal' },
			{ date: new Date(2026, 10, 2), status: 'over' },
			{ date: new Date(2026, 10, 3), status: 'empty' },
			{ date: new Date(2026, 10, 4), status: 'empty', isUpcoming: false },
		])

		expect(screen.getByRole('button', { name: 'Неділя, 1 листопада, у нормі' })).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Понеділок, 2 листопада, понад ціль' })).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Вівторок, 3 листопада, без записів' })).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Середа, 4 листопада, без записів' })).toBeTruthy()
		expect(screen.queryByRole('button', { name: /ще попереду/ })).toBeNull()
	})

	it('does not use the removed key todayAhead.dayUpcomingEmpty', () => {
		expect(i18n.exists('todayAhead.dayUpcomingEmpty')).toBe(false)
	})
})
