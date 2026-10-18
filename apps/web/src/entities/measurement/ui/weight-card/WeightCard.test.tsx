// @vitest-environment jsdom
import type { MeasurementCard } from '@kus/shared'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'

import { WeightCard } from './WeightCard'

const TODAY = '2026-10-05'

const createCard = (overrides: Partial<MeasurementCard> = {}): MeasurementCard => ({
	id: '0199b3a4-0000-7000-8000-000000000001',
	kind: 'WEIGHT',
	value: 82.4,
	localDate: TODAY,
	source: 'CHAT',
	measuredAt: null,
	isDeleted: false,
	fromStart: -1.6,
	toGoal: 4.4,
	isGoalReached: false,
	weekChange: -0.4,
	planPaceKgPerWeek: 0.25,
	chart: [
		{ localDate: '2026-09-05', value: 84 },
		{ localDate: '2026-09-12', value: 83.7 },
		{ localDate: '2026-09-19', value: 83.2 },
		{ localDate: '2026-09-26', value: 82.9 },
		{ localDate: TODAY, value: 82.4 },
	],
	...overrides,
})

const renderCard = (card: MeasurementCard, note?: string) =>
	render(
		<MemoryRouter>
			<WeightCard card={card} today={TODAY} note={note} />
		</MemoryRouter>,
	)

afterEach(cleanup)

describe('WeightCard', () => {
	it('shows the value, the start and the goal like the chat-weight mockup', () => {
		renderCard(createCard(), 'Записав вагу на сьогодні.')

		expect(screen.getByText('Вагу записано')).toBeTruthy()
		expect(screen.getByText('82,4 кг')).toBeTruthy()
		expect(screen.getByText('Від старту')).toBeTruthy()
		expect(screen.getByText('−1,6 кг')).toBeTruthy()
		expect(screen.getByText('До цілі')).toBeTruthy()
		expect(screen.getByText('4,4 кг')).toBeTruthy()
		expect(screen.getByText('Від старту').closest('.grid')?.className).toContain('grid-cols-2')
		expect(screen.getByText('5 вер · 84,0')).toBeTruthy()
		expect(screen.getByText('сьогодні')).toBeTruthy()
	})

	it('joins the numeric sentence and Kusik’s words', () => {
		renderCard(createCard(), 'Записав вагу на сьогодні.')

		expect(
			screen.getByText(
				'Мінус 0,4 кг за тиждень, трохи швидше за план — без поспіху. Записав вагу на сьогодні.',
			),
		).toBeTruthy()
	})

	it('links to the progress screen', () => {
		renderCard(createCard())

		expect(screen.getByRole('link', { name: 'Відкрити прогрес' }).getAttribute('href')).toBe(
			'/app/progress',
		)
	})

	it('names the chart with its range', () => {
		renderCard(createCard())

		expect(screen.getByRole('img', { name: 'Вага: з 84,0 кг до 82,4 кг' })).toBeTruthy()
	})

	it('says «Ціль досягнута» instead of the remaining kilograms', () => {
		renderCard(createCard({ toGoal: 0, isGoalReached: true }))

		expect(screen.getByText('Ціль досягнута')).toBeTruthy()
		expect(screen.queryByText('0,0 кг')).toBeNull()
	})

	it('hides «До цілі» without a goal direction', () => {
		renderCard(createCard({ toGoal: null, isGoalReached: null, planPaceKgPerWeek: null }))

		expect(screen.queryByText('До цілі')).toBeNull()
		expect(screen.getByText('Від старту')).toBeTruthy()
	})

	it('shows the waist without «До цілі» and with centimetres', () => {
		renderCard(
			createCard({
				kind: 'WAIST',
				value: 94,
				fromStart: -2,
				toGoal: null,
				isGoalReached: null,
				planPaceKgPerWeek: null,
				weekChange: -1,
				chart: [
					{ localDate: '2026-09-26', value: 96 },
					{ localDate: TODAY, value: 94 },
				],
			}),
		)

		expect(screen.getByText('Талію записано')).toBeTruthy()
		expect(screen.getByText('94 см')).toBeTruthy()
		expect(screen.getByText('Від старту').closest('.grid')?.className).toContain('grid-cols-1')
		expect(screen.getByText('−2,0 см')).toBeTruthy()
		expect(screen.getByText('Мінус 1 см за тиждень.')).toBeTruthy()
		expect(screen.queryByText('До цілі')).toBeNull()
	})

	it('hides «Від старту» and the start label for the very first weigh-in, and draws a dot', () => {
		const { container } = renderCard(
			createCard({
				fromStart: null,
				toGoal: 10,
				weekChange: null,
				chart: [{ localDate: TODAY, value: 82.4 }],
			}),
		)

		expect(screen.queryByText('Від старту')).toBeNull()
		expect(screen.queryByText(/ · /)).toBeNull()
		expect(screen.getByRole('img', { name: 'Вага: 82,4 кг' })).toBeTruthy()
		expect(container.querySelector('svg path')).toBeNull()
		expect(container.querySelector('[data-sparkline-dot]')).not.toBeNull()
	})

	it('dates the last chart label when the weigh-in is not from today', () => {
		renderCard(createCard({ localDate: '2026-10-03' }))

		expect(screen.queryByText('сьогодні')).toBeNull()
		expect(screen.getByText('3 жовт')).toBeTruthy()
	})

	it('has no «Редагувати» without a handler', () => {
		renderCard(createCard())

		expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
	})

	it('«Редагувати» calls the handler the page passed down', () => {
		const onEdit = vi.fn()
		render(
			<MemoryRouter>
				<WeightCard card={createCard()} today={TODAY} onEdit={onEdit} />
			</MemoryRouter>,
		)

		fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))

		expect(onEdit).toHaveBeenCalledTimes(1)
	})

	it('marks a corrected value with «· змінено» next to the title', () => {
		renderCard(createCard({ source: 'EDIT' }))

		expect(screen.getByText(/· змінено/)).toBeTruthy()
	})

	it('has no mark for a value from the chat', () => {
		renderCard(createCard({ source: 'CHAT' }))

		expect(screen.queryByText(/змінено/)).toBeNull()
	})
})
