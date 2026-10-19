// @vitest-environment jsdom
import type { DayResponse, LoggedMeal } from '@kus/shared'
import type { UseQueryResult } from '@tanstack/react-query'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { DayContent } from './DayContent'

const TODAY = '2026-10-18'
const TOMORROW = '2026-10-19'
const TIME_PATTERN = /\d{2}:\d{2}/

// only the fields the day card and the meal row read
const createMeal = (localDate: string): LoggedMeal =>
	({
		id: '0199b3a4-0000-7000-8000-000000000031',
		type: 'LUNCH',
		localDate,
		eatenAt: `${localDate}T11:30:00.000Z`,
		totals: { kcal: 525, protein: 52, carbs: 47, fat: 12, fiber: 0 },
		mealTotalKcal: null,
		entries: [],
	}) as unknown as LoggedMeal

const createQuery = (localDate: string, meals: LoggedMeal[]): UseQueryResult<DayResponse> =>
	({
		isPending: false,
		isError: false,
		data: {
			localDate,
			meals,
			totals: {
				kcal: meals.length > 0 ? 525 : 0,
				protein: meals.length > 0 ? 52 : 0,
				carbs: meals.length > 0 ? 47 : 0,
				fat: meals.length > 0 ? 12 : 0,
				fiber: 0,
			},
			goal: { kcal: 2200, protein: 140, carbs: 230, fat: 80 },
			remainingKcal: 1675,
		},
	}) as unknown as UseQueryResult<DayResponse>

const renderDay = (localDate: string, meals: LoggedMeal[]) =>
	renderWithProviders(
		<DayContent
			query={createQuery(localDate, meals)}
			localDate={localDate}
			today={TODAY}
			onGoalClick={vi.fn()}
			onEmptyAction={vi.fn()}
		/>,
	)

// jsdom draws no SVG geometry: the ring only needs a length to set its dash
beforeAll(() => {
	Object.defineProperty(window.SVGElement.prototype, 'getTotalLength', {
		configurable: true,
		value: () => 100,
	})
})

afterEach(cleanup)

describe('DayContent ahead', () => {
	it("tomorrow with food: «заплановано» instead of «з'їдено» and no meal time", () => {
		renderDay(TOMORROW, [createMeal(TOMORROW)])

		expect(screen.getByText('заплановано')).toBeTruthy()
		expect(screen.queryByText("з'їдено")).toBeNull()
		expect(screen.getByText('Обід')).toBeTruthy()
		expect(screen.queryByText(TIME_PATTERN)).toBeNull()
	})

	it("today with food keeps «з'їдено» and the time", () => {
		renderDay(TODAY, [createMeal(TODAY)])

		expect(screen.getByText("з'їдено")).toBeTruthy()
		expect(screen.queryByText('заплановано')).toBeNull()
		expect(screen.getByText(TIME_PATTERN)).toBeTruthy()
	})

	it('an empty tomorrow gets its own empty state', () => {
		renderDay(TOMORROW, [])

		expect(screen.getByText('На завтра ще нічого не записано')).toBeTruthy()
	})

	it.each([
		['2026-10-16', 'Ще можна дописати'],
		['2026-10-14', 'Kusik дописує лише до 3 днів назад'],
	])('an empty %s explains what can still be done', (localDate, text) => {
		renderDay(localDate, [])

		expect(screen.getByText('Цього дня нічого не записано')).toBeTruthy()
		expect(screen.getByText(new RegExp(text))).toBeTruthy()
	})
})
