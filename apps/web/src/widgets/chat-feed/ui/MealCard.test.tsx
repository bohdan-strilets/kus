// @vitest-environment jsdom
import type { LoggedMeal } from '@kus/shared'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { MealCard } from './MealCard'

const TODAY = '2026-10-18'
const TIME_PATTERN = /\d{2}:\d{2}/

const createMeal = (localDate: string): LoggedMeal =>
	// only the fields MealCard reads
	({
		id: '0199b3a4-0000-7000-8000-000000000031',
		type: 'LUNCH',
		localDate,
		eatenAt: `${localDate}T11:30:00.000Z`,
		totals: { kcal: 525, protein: 40, carbs: 50, fat: 15, fiber: 0 },
		mealTotalKcal: null,
		entries: [],
	}) as unknown as LoggedMeal

const renderCard = (localDate: string) =>
	renderWithProviders(
		<MealCard
			meal={createMeal(localDate)}
			today={TODAY}
			clarifications={[]}
			placement={new Map()}
			isLatestReply
			hasTail
			index={0}
		/>,
	)

afterEach(cleanup)

describe('MealCard day plate', () => {
	it('today: no plate and the time of the meal', () => {
		renderCard(TODAY)

		expect(screen.queryByText(/Вчора|На завтра/)).toBeNull()
		expect(screen.getByText(TIME_PATTERN)).toBeTruthy()
	})

	it.each([
		['2026-10-17', 'Вчора, 17.10'],
		['2026-10-19', 'На завтра, 19.10'],
		['2026-10-16', 'Пт, 16.10'],
	])('%s: plate «%s» and no time', (localDate, label) => {
		renderCard(localDate)

		expect(screen.getByText(label)).toBeTruthy()
		expect(screen.getByText('Обід')).toBeTruthy()
		expect(screen.queryByText(TIME_PATTERN)).toBeNull()
	})
})
