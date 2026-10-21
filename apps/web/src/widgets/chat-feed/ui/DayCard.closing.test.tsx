// @vitest-environment jsdom
import { chatMessageSchema, type DayCard as DayCardData } from '@kus/shared'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { DayCard } from './DayCard'

const TODAY = '2026-10-19'

const createCard = (overrides: Partial<DayCardData> = {}): DayCardData => ({
	version: 1,
	localDate: TODAY,
	kind: 'today',
	asOf: '2026-10-19T19:40:00.000Z',
	totals: { kcal: 2160, protein: 132, fat: 76, carbs: 221 },
	goal: { kcal: 2200, protein: 140, fat: 80, carbs: 230 },
	remainingKcal: 40,
	meals: [
		{ type: 'BREAKFAST', eatenAt: '2026-10-19T06:40:00.000Z', kcal: 370, hasUndetailed: false },
		{ type: 'DINNER', eatenAt: '2026-10-19T17:40:00.000Z', kcal: 790, hasUndetailed: false },
	],
	verdict: 'on_goal',
	isClosing: true,
	...overrides,
})

const renderCard = (card: DayCardData, props: { note?: string } = {}) =>
	renderWithProviders(<DayCard card={card} today={TODAY} {...props} />)

beforeAll(() => {
	Object.defineProperty(window.SVGElement.prototype, 'getTotalLength', {
		configurable: true,
		value: () => 100,
	})
})

afterEach(cleanup)

describe('DayCard: closing the day', () => {
	it('on goal: «День закрито» instead of the time, «В цілі» and the protein fact', () => {
		renderCard(createCard(), { note: 'слова моделі' })

		expect(screen.getByText('День закрито')).toBeTruthy()
		expect(screen.getByText('Сьогодні, 19.10')).toBeTruthy()
		expect(screen.queryByText(/^на \d{2}:\d{2}$/)).toBeNull()
		expect(screen.getByText('В цілі')).toBeTruthy()
		expect(screen.getByText('Калорії в цілі, білок — 132 г з 140.')).toBeTruthy()
		expect(screen.queryByText('слова моделі')).toBeNull()
		expect(screen.queryByText('ккал лишилось')).toBeNull()
	})

	it('over the goal: +N in over-ink and the fixed sentence', () => {
		renderCard(
			createCard({
				verdict: 'over',
				remainingKcal: -180,
				totals: { kcal: 2380, protein: 118, fat: 84, carbs: 236 },
			}),
		)

		const excess = screen.getByText('+180')
		expect(excess.className).toContain('text-over-ink')
		expect(excess.className).not.toContain('danger')
		expect(screen.getByText('ккал понад ціль')).toBeTruthy()
		expect(screen.getByText('Понад ціль на 180 — буває. Завтра просто як завжди.')).toBeTruthy()
		expect(screen.queryByText('В цілі')).toBeNull()
	})

	it('under the goal: the shortfall as a plain fact, no praise', () => {
		renderCard(
			createCard({
				verdict: 'under',
				remainingKcal: 320,
				totals: { kcal: 1880, protein: 118, fat: 70, carbs: 190 },
			}),
		)

		const shortfall = screen.getByText('320')
		expect(shortfall.className).not.toContain('success')
		expect(screen.getByText('ккал нижче цілі')).toBeTruthy()
		expect(screen.getByText('Білок — 118 г з 140.')).toBeTruthy()
		expect(screen.queryByText('В цілі')).toBeNull()
	})

	it('far under the goal: only the numbers and the offer to add what is missing', () => {
		renderCard(
			createCard({
				verdict: 'far_under',
				remainingKcal: 1080,
				totals: { kcal: 1120, protein: 60, fat: 30, carbs: 100 },
			}),
		)

		expect(screen.queryByText('1 080')).toBeNull()
		expect(screen.queryByText('ккал нижче цілі')).toBeNull()
		expect(screen.queryByText('В цілі')).toBeNull()
		expect(screen.getByText(/^з 2\s200 ккал$/)).toBeTruthy()
		expect(
			screen.getByText('Якщо щось не записалось — напиши, і я додам до цього дня.'),
		).toBeTruthy()
	})

	it('without a goal: the day total instead of the ring, no sentence', () => {
		renderCard(
			createCard({
				verdict: 'no_goal',
				goal: null,
				remainingKcal: null,
				totals: { kcal: 1980, protein: 118, fat: 70, carbs: 236 },
			}),
		)

		expect(screen.getByText('за день · ціль не задана')).toBeTruthy()
		expect(screen.queryByRole('img')).toBeNull()
		expect(screen.queryByText(/білок/i)).toBeNull()
		expect(screen.getByRole('link', { name: 'Відкрити «Сьогодні»' })).toBeTruthy()
	})

	it('a meal with hasUndetailed says «без деталей» with the time and «≈ N»', () => {
		renderCard(
			createCard({
				meals: [
					{ type: 'DINNER', eatenAt: '2026-10-19T17:40:00.000Z', kcal: 520, hasUndetailed: false },
					{ type: 'SNACK', eatenAt: '2026-10-19T19:45:00.000Z', kcal: 300, hasUndetailed: true },
				],
			}),
		)

		expect(screen.getByText('≈ 300')).toBeTruthy()
		expect(screen.getByText(/^\d{2}:\d{2} · без деталей$/)).toBeTruthy()
		expect(screen.getByText('520')).toBeTruthy()
		expect(screen.getByText('Калорії в цілі. Перекус — оцінка, його можна уточнити.')).toBeTruthy()
	})

	it('no flag, no estimate: a meal of the same type and kcal is an ordinary row', () => {
		renderCard(
			createCard({
				meals: [
					{ type: 'SNACK', eatenAt: '2026-10-19T16:30:00.000Z', kcal: 300, hasUndetailed: false },
				],
			}),
		)

		expect(screen.queryByText('≈ 300')).toBeNull()
		expect(screen.queryByText(/без деталей/)).toBeNull()
		expect(screen.getByText('Калорії в цілі, білок — 132 г з 140.')).toBeTruthy()
	})
})

describe('DayCard: compatibility with an older API', () => {
	it('a card without verdict and isClosing draws as before 0.7.0', () => {
		const old = createCard()
		const { verdict: _verdict, isClosing: _isClosing, ...withoutNew } = old
		renderCard(withoutNew, { note: 'Вечері ще немає.' })

		expect(screen.queryByText('День закрито')).toBeNull()
		expect(screen.getByText('Сьогодні')).toBeTruthy()
		expect(screen.getByText(/^на \d{2}:\d{2}$/)).toBeTruthy()
		expect(screen.getByText('ккал лишилось')).toBeTruthy()
		expect(screen.getByText('Вечері ще немає.')).toBeTruthy()
	})

	it('a verdict without isClosing (a plain look at a day) keeps the old card', () => {
		renderCard(createCard({ isClosing: undefined, verdict: 'over', remainingKcal: -50 }), {
			note: 'Трохи понад ціль — буває.',
		})

		expect(screen.queryByText('День закрито')).toBeNull()
		expect(screen.getByText('Трохи понад ціль — буває.')).toBeTruthy()
		expect(screen.getByText('ккал понад ціль')).toBeTruthy()
	})

	it('a reply of an older server parses with no statsCard and a day card without the new fields', () => {
		const parsed = chatMessageSchema.parse({
			id: '0199b3a4-0000-7000-8000-000000000012',
			role: 'ASSISTANT',
			content: null,
			status: 'COMPLETED',
			clientMessageId: null,
			replyToId: '0199b3a4-0000-7000-8000-000000000011',
			createdAt: '2026-10-19T10:00:00.000Z',
			photo: null,
			meals: [],
			clarifications: [],
			measurements: [],
			achievements: [],
			dayCard: {
				version: 1,
				localDate: TODAY,
				kind: 'today',
				asOf: '2026-10-19T10:00:00.000Z',
				totals: { kcal: 100, protein: 1, fat: 1, carbs: 1 },
				goal: null,
				remainingKcal: null,
				meals: [{ type: 'BREAKFAST', eatenAt: null, kcal: 100 }],
			},
		})

		expect(parsed.statsCard).toBeNull()
		expect(parsed.dayCard?.verdict).toBeUndefined()
		expect(parsed.dayCard?.isClosing).toBeUndefined()
		expect(parsed.dayCard?.meals[0]?.hasUndetailed).toBe(false)
	})
})
