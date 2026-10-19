// @vitest-environment jsdom
import { type DayCard as DayCardData, chatMessageSchema } from '@kus/shared'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { DayCard } from './DayCard'

const TODAY = '2026-10-18'

const createCard = (overrides: Partial<DayCardData> = {}): DayCardData => ({
	version: 1,
	localDate: TODAY,
	kind: 'today',
	asOf: '2026-10-18T16:40:00.000Z',
	totals: { kcal: 1370, protein: 78, fat: 48, carbs: 160 },
	goal: { kcal: 2200, protein: 140, fat: 80, carbs: 230 },
	remainingKcal: 830,
	meals: [
		{ type: 'BREAKFAST', eatenAt: '2026-10-18T06:40:00.000Z', kcal: 370 },
		{ type: 'LUNCH', eatenAt: null, kcal: 620 },
	],
	...overrides,
})

const renderCard = (card: DayCardData, note?: string) =>
	renderWithProviders(<DayCard card={card} today={TODAY} note={note} />)

// jsdom draws no SVG geometry: the ring only needs a length to set its dash
beforeAll(() => {
	Object.defineProperty(window.SVGElement.prototype, 'getTotalLength', {
		configurable: true,
		value: () => 100,
	})
})

afterEach(cleanup)

describe('DayCard', () => {
	it('today: title, what is left, meals and the link to «Сьогодні»', () => {
		renderCard(createCard(), 'Вечері ще немає.')

		expect(screen.getByText('Сьогодні')).toBeTruthy()
		expect(screen.getByText(/^на \d{2}:\d{2}$/)).toBeTruthy()
		expect(screen.getByText('830')).toBeTruthy()
		expect(screen.getByText('ккал лишилось')).toBeTruthy()
		expect(screen.getByText('Сніданок')).toBeTruthy()
		expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeTruthy()
		expect(screen.getByText('370')).toBeTruthy()
		expect(screen.getByText('Вечері ще немає.')).toBeTruthy()
		expect(screen.getByRole('link', { name: 'Відкрити «Сьогодні»' }).getAttribute('href')).toBe(
			'/app/today',
		)
	})

	it('over the goal: +N in the over text, not «лишилось»', () => {
		renderCard(
			createCard({ remainingKcal: -180, totals: { kcal: 2380, protein: 1, fat: 1, carbs: 1 } }),
		)

		expect(screen.getByText('+180')).toBeTruthy()
		expect(screen.getAllByText('ккал понад ціль')).toHaveLength(1)
		expect(screen.getByText(/^з 2\s200 ккал$/)).toBeTruthy()
		expect(screen.queryByText('ккал лишилось')).toBeNull()
	})

	it('without a goal: no «лишилось» block', () => {
		renderCard(createCard({ goal: null, remainingKcal: null }))

		expect(screen.queryByText('ккал лишилось')).toBeNull()
		expect(screen.queryByText('ккал понад ціль')).toBeNull()
	})

	it('past: «Вчора» with «весь день» and a link to that day', () => {
		renderCard(createCard({ kind: 'past', localDate: '2026-10-17', asOf: null }))

		expect(screen.getByText('Вчора, 17.10')).toBeTruthy()
		expect(screen.getByText('весь день')).toBeTruthy()
		expect(screen.queryByText(/^\d{2}:\d{2}$/)).toBeNull()
		expect(screen.getByRole('link', { name: 'Відкрити день' }).getAttribute('href')).toBe(
			'/app/today?date=2026-10-17',
		)
	})

	it('planned: «Завтра» with «заплановано»', () => {
		renderCard(createCard({ kind: 'planned', localDate: '2026-10-19', asOf: null }))

		expect(screen.getByText('Завтра, 19.10')).toBeTruthy()
		expect(screen.getByText('заплановано')).toBeTruthy()
		expect(screen.queryByText(/^\d{2}:\d{2}$/)).toBeNull()
	})
})

describe('ChatMessage without dayCard (older API)', () => {
	it('parses to dayCard: null', () => {
		const parsed = chatMessageSchema.parse({
			id: '0199b3a4-0000-7000-8000-000000000011',
			role: 'ASSISTANT',
			content: 'ok',
			status: 'COMPLETED',
			clientMessageId: null,
			replyToId: null,
			createdAt: '2026-10-18T10:00:00.000Z',
			photo: null,
			meals: [],
			clarifications: [],
			measurements: [],
			achievements: [],
		})

		expect(parsed.dayCard).toBeNull()
	})
})
