// @vitest-environment jsdom
import {
	type ChatMessage,
	chatMessageSchema,
	type DayCard,
	type StatsCard as StatsCardData,
} from '@kus/shared'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { KusikReply } from './KusikReply'

vi.mock('./MealCard', () => ({ MealCard: () => <div data-testid="meal-card" /> }))

const TODAY = '2026-10-19'

const dayCard: DayCard = {
	version: 1,
	localDate: TODAY,
	kind: 'today',
	asOf: '2026-10-19T19:40:00.000Z',
	totals: { kcal: 2160, protein: 132, fat: 76, carbs: 221 },
	goal: { kcal: 2200, protein: 140, fat: 80, carbs: 230 },
	remainingKcal: 40,
	meals: [{ type: 'SNACK', eatenAt: '2026-10-19T19:45:00.000Z', kcal: 300, hasUndetailed: false }],
	verdict: 'on_goal',
	isClosing: true,
}

const statsCard: StatsCardData = {
	version: 1,
	period: 'month',
	from: '2026-09-20',
	to: TODAY,
	loggedDays: 26,
	daysInNorm: 19,
	avgKcal: 2160,
	avgProteinG: 121,
	goalKcal: 2200,
	weightChangeKg: -1.6,
	proteinGoalG: 140,
	weightStartKg: 84,
	weightEndKg: 82.4,
	days: [],
}

const estimateMeal = {
	id: '0199b3a4-0000-7000-8000-000000000031',
	type: 'SNACK',
	totals: { kcal: 300 },
	mealTotalKcal: null,
	entries: [{ name: 'Без деталей', source: 'ESTIMATE', isUndetailed: true }],
}

const estimateDayCard: DayCard = {
	...dayCard,
	meals: [{ type: 'SNACK', eatenAt: '2026-10-19T19:45:00.000Z', kcal: 300, hasUndetailed: true }],
}

const createReply = (overrides: Partial<ChatMessage>): ChatMessage =>
	// only the fields KusikReply reads
	({
		id: '0199b3a4-0000-7000-8000-000000000011',
		replyToId: '0199b3a4-0000-7000-8000-000000000001',
		content: null,
		meals: [],
		measurements: [],
		achievements: [],
		clarifications: [],
		dayCard: null,
		statsCard: null,
		...overrides,
	}) as unknown as ChatMessage

const renderReply = (message: ChatMessage) =>
	renderWithProviders(<KusikReply message={message} today={TODAY} isLatest />)

beforeAll(() => {
	Object.defineProperty(window.SVGElement.prototype, 'getTotalLength', {
		configurable: true,
		value: () => 100,
	})
})

afterEach(cleanup)

describe('KusikReply: close the day', () => {
	it('a plain close is the card alone, with its fixed sentence', () => {
		renderReply(createReply({ dayCard }))

		expect(screen.getByText('День закрито')).toBeTruthy()
		expect(screen.getByText('Калорії в цілі, білок — 132 г з 140.')).toBeTruthy()
	})

	it('a close with an estimate: the meal card, then the card pointing at the estimate, no words', () => {
		renderReply(
			createReply({
				dayCard: estimateDayCard,
				content: 'Додав перекус без деталей — ≈ 300 ккал — і закриваю день.',
				meals: [estimateMeal] as unknown as ChatMessage['meals'],
			}),
		)

		expect(
			screen.queryByText('Додав перекус без деталей — ≈ 300 ккал — і закриваю день.'),
		).toBeNull()
		expect(screen.getByTestId('meal-card')).toBeTruthy()
		expect(screen.getByText('≈ 300')).toBeTruthy()
		expect(screen.getByText('Калорії в цілі. Перекус — оцінка, його можна уточнити.')).toBeTruthy()
	})

	it('a close hides the model words: the card alone', () => {
		renderReply(createReply({ dayCard, content: 'Закриваю день, гарна робота!' }))

		expect(screen.queryByText('Закриваю день, гарна робота!')).toBeNull()
		expect(screen.getByText('День закрито')).toBeTruthy()
	})

	it('without a card the words stay a plain bubble', () => {
		renderReply(createReply({ dayCard: null, content: 'Не вдалося закрити день.' }))

		expect(screen.getByText('Не вдалося закрити день.')).toBeTruthy()
		expect(screen.queryByText('День закрито')).toBeNull()
	})

	it('an empty-day card is not drawn, the words stay (closing or not)', () => {
		renderReply(
			createReply({ dayCard: { ...dayCard, verdict: 'empty' }, content: 'Сьогодні нічого немає.' }),
		)

		expect(screen.getByText('Сьогодні нічого немає.')).toBeTruthy()
		expect(screen.queryByText('День закрито')).toBeNull()
		cleanup()

		renderReply(
			createReply({
				dayCard: { ...dayCard, verdict: 'empty', isClosing: undefined },
				content: 'Ще порожньо.',
			}),
		)

		expect(screen.getByText('Ще порожньо.')).toBeTruthy()
		expect(screen.queryByRole('article')).toBeNull()
	})

	it('a plain look at a day keeps the model sentence inside the card', () => {
		renderReply(
			createReply({ dayCard: { ...dayCard, isClosing: undefined }, content: 'Вечері ще немає.' }),
		)

		expect(screen.queryByText('День закрито')).toBeNull()
		expect(screen.getByText('Вечері ще немає.')).toBeTruthy()
	})
})

describe('KusikReply: stats', () => {
	it('shows the stats card alone, without the model words (like the closing card)', () => {
		renderReply(createReply({ statsCard, content: 'Ось твій місяць.' }))

		expect(screen.getByText('За 30 днів')).toBeTruthy()
		expect(screen.queryByText('Ось твій місяць.')).toBeNull()
	})

	it('without a card the words stay a plain reply', () => {
		renderReply(createReply({ statsCard: null, content: 'Ось твій місяць.' }))

		expect(screen.getByText('Ось твій місяць.')).toBeTruthy()
	})

	it('a card of any length shows its own title', () => {
		renderReply(
			createReply({
				statsCard: { ...statsCard, period: 'week', periodDays: 15, from: '2026-10-05' },
				content: 'Ось 15 днів.',
			}),
		)

		expect(screen.getByText(/^15 днів · \d{2}\.\d{2}–\d{2}\.\d{2}$/)).toBeTruthy()
	})

	it('a card this client cannot read leaves the message as a plain text reply', () => {
		const message = chatMessageSchema.parse({
			id: '0199b3a4-0000-7000-8000-000000000011',
			role: 'ASSISTANT',
			content: 'Ось твої 15 днів.',
			status: 'COMPLETED',
			clientMessageId: null,
			replyToId: '0199b3a4-0000-7000-8000-000000000001',
			createdAt: '2026-10-19T10:00:00.000Z',
			photo: null,
			meals: [],
			clarifications: [],
			measurements: [],
			achievements: [],
			statsCard: { ...statsCard, period: 'year' },
			workoutCard: { version: 1 },
		})

		renderReply(message)

		expect(message.statsCard).toBeNull()
		expect(screen.getByText('Ось твої 15 днів.')).toBeTruthy()
	})

	it('without a card (nothing logged in the period) it is a plain text reply', () => {
		renderReply(createReply({ content: 'За цей період ще нічого не записано.' }))

		expect(screen.getByText('За цей період ще нічого не записано.')).toBeTruthy()
		expect(screen.queryByText('За 30 днів')).toBeNull()
	})
})
