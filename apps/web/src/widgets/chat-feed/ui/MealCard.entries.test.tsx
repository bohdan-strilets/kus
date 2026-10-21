// @vitest-environment jsdom
import type { FoodEntryResponse, LoggedMeal } from '@kus/shared'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { MealCard } from './MealCard'

vi.mock('motion', () => ({ animate: vi.fn(() => ({ stop: vi.fn() })) }))

// Sunday
const TODAY = '2026-10-18'

const createEntry = (overrides: Partial<FoodEntryResponse>): FoodEntryResponse => ({
	id: '0199b3a4-0000-7000-8000-000000000010',
	name: 'Вівсянка на молоці',
	grams: 250,
	quantity: null,
	kcal: 255,
	protein: 9,
	fat: 8,
	carbs: 37,
	fiber: 4,
	category: 'porridge',
	source: 'LABEL',
	confidence: 0.9,
	assumption: null,
	isEdited: false,
	copiedFromDate: null,
	isUndetailed: false,
	...overrides,
})

const createMeal = (entries: FoodEntryResponse[]): LoggedMeal =>
	// only the fields MealCard reads
	({
		id: '0199b3a4-0000-7000-8000-000000000031',
		type: 'SNACK',
		localDate: TODAY,
		eatenAt: `${TODAY}T19:45:00.000Z`,
		totals: { kcal: 300, protein: 8, carbs: 35, fat: 14, fiber: 0 },
		mealTotalKcal: null,
		entries,
	}) as unknown as LoggedMeal

const renderCard = (entries: FoodEntryResponse[]) =>
	renderWithProviders(
		<MealCard
			meal={createMeal(entries)}
			today={TODAY}
			clarifications={[]}
			placement={new Map()}
			isLatestReply
			hasTail
			index={0}
		/>,
	)

afterEach(cleanup)

describe('MealCard: copied from an earlier day', () => {
	it.each([
		['2026-10-17', 'як учора'],
		['2026-10-15', 'як у четвер'],
		['2026-10-10', 'як 10.10'],
	])('copiedFromDate %s reads «%s»', (copiedFromDate, label) => {
		renderCard([createEntry({ copiedFromDate })])

		expect(screen.getByText(label)).toBeTruthy()
		expect(screen.getByText(/^250 г ·/)).toBeTruthy()
	})

	it('wins over «як завжди» when both fit', () => {
		renderCard([createEntry({ source: 'MEMORY', copiedFromDate: '2026-10-17' })])

		expect(screen.getByText('як учора')).toBeTruthy()
		expect(screen.queryByText('як завжди')).toBeNull()
	})

	it('without copiedFromDate nothing is guessed: «як завжди» keeps the amount', () => {
		renderCard([createEntry({ source: 'MEMORY', category: 'coffee' })])

		expect(screen.getByText('як завжди')).toBeTruthy()
		expect(screen.getByText(/^250 мл ·/)).toBeTruthy()
		expect(screen.queryByText('як учора')).toBeNull()
	})

	it('goes away once the entry is edited by hand', () => {
		renderCard([createEntry({ copiedFromDate: '2026-10-17', isEdited: true })])

		expect(screen.queryByText('як учора')).toBeNull()
	})
})

describe('MealCard: the «Без деталей» estimate', () => {
	const estimate = createEntry({
		name: 'Без деталей',
		kcal: 300,
		protein: 8,
		carbs: 35,
		fat: 14,
		category: 'plate',
		source: 'ESTIMATE',
		isUndetailed: true,
	})

	it('reads «оцінка», «≈ 300», the badge and the macros with «≈»', () => {
		renderCard([estimate])

		expect(screen.getByText('Без деталей')).toBeTruthy()
		expect(screen.getByText('оцінка')).toBeTruthy()
		expect(screen.getByText('≈ 300')).toBeTruthy()
		expect(screen.getByText('≈ 300 ккал')).toBeTruthy()
		expect(screen.getByText('Б ≈ 8 · В ≈ 35 · Ж ≈ 14')).toBeTruthy()
		expect(document.querySelector('[data-icon="more"]')).not.toBeNull()
	})

	it('an ordinary meal has no «≈» anywhere', () => {
		renderCard([createEntry({ kcal: 300 })])

		expect(screen.queryByText(/≈/)).toBeNull()
		expect(screen.queryByText('оцінка')).toBeNull()
		expect(document.querySelector('[data-icon="more"]')).toBeNull()
	})
})
