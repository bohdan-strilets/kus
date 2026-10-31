// @vitest-environment jsdom
import type { ChatMessage } from '@kus/shared'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFreshReplyStore } from '@/entities/message'
import { useGoalCelebrationStore } from '@/entities/stats'

import { KusikReply } from './KusikReply'

vi.mock('./MealCard', () => ({ MealCard: () => <div data-testid="meal-card" /> }))
vi.mock('@/entities/achievement', async (importOriginal) => ({
	...(await importOriginal<object>()),
	AchievementCard: ({ achievement }: { achievement: { type: string; value: number } }) => (
		<div data-testid="achievement-card">{`${achievement.type}:${achievement.value}`}</div>
	),
}))
vi.mock('@/entities/measurement', () => ({
	WeightCard: ({ note }: { note?: string }) => <div data-testid="weight-card">{note}</div>,
}))

const TODAY = '2026-10-05'

const REPLY_ID = '0199b3a4-0000-7000-8000-000000000011'
const OTHER_ID = '0199b3a4-0000-7000-8000-000000000022'

const createReply = (overrides: Partial<ChatMessage> = {}): ChatMessage =>
	// only the fields KusikReply reads
	({
		id: REPLY_ID,
		replyToId: '0199b3a4-0000-7000-8000-000000000001',
		content: 'ok',
		meals: [],
		measurements: [],
		workouts: [],
		workoutCards: [],
		achievements: [],
		clarifications: [],
		...overrides,
	}) as unknown as ChatMessage

const getMood = (container: HTMLElement): string | null =>
	container.querySelector('[data-mood]')?.getAttribute('data-mood') ?? null

const reveal = (id: string | null) => {
	act(() => {
		useGoalCelebrationStore.getState().revealReply(id)
	})
}

beforeEach(() => {
	useGoalCelebrationStore.setState({ celebratedReplyId: null })
})

afterEach(cleanup)

describe('KusikReply face', () => {
	it('smiles by default', () => {
		const { container } = render(<KusikReply message={createReply()} today={TODAY} isLatest />)
		expect(getMood(container)).toBe('smile')
	})

	it('is happy when this reply closed the day goal', () => {
		const { container } = render(<KusikReply message={createReply()} today={TODAY} isLatest />)
		reveal(REPLY_ID)
		expect(getMood(container)).toBe('happy')
	})

	it('stays unchanged when the goal was closed by another reply', () => {
		const { container } = render(<KusikReply message={createReply()} today={TODAY} isLatest />)
		reveal(OTHER_ID)
		expect(getMood(container)).toBe('smile')
	})

	it('lets an open clarification win over the goal', () => {
		const message = createReply({
			clarifications: [{ id: 'q1', status: 'OPEN' }] as unknown as ChatMessage['clarifications'],
		})
		const { container } = render(<KusikReply message={message} today={TODAY} isLatest />)
		reveal(REPLY_ID)
		expect(getMood(container)).toBe('smile')
	})

	it('lets a failed photo win over the goal', () => {
		const { container } = render(
			<KusikReply message={createReply()} today={TODAY} isLatest photoStatus="FAILED" />,
		)
		reveal(REPLY_ID)
		expect(getMood(container)).toBe('oops')
	})
})

const WEIGHT = [{ id: 'w1' }] as unknown as ChatMessage['measurements']
const MEALS = [{ id: 'm1' }] as unknown as ChatMessage['meals']

describe('KusikReply measurements', () => {
	it('puts Kusik’s words inside the card of a bare weigh-in, without a bubble', () => {
		const { container } = render(
			<KusikReply
				message={createReply({ content: 'Записав.', measurements: WEIGHT })}
				today={TODAY}
				isLatest
			/>,
		)

		expect(screen.getByTestId('weight-card').textContent).toBe('Записав.')
		expect(screen.getAllByText('Записав.')).toHaveLength(1)
		expect(getMood(container)).toBe('proud')
	})

	it('shows the bubble and both cards when a reply has a meal and a weigh-in', () => {
		render(
			<KusikReply
				message={createReply({ content: 'Записав усе.', meals: MEALS, measurements: WEIGHT })}
				today={TODAY}
				isLatest
			/>,
		)

		expect(screen.getByText('Записав усе.')).toBeTruthy()
		expect(screen.getByTestId('meal-card')).toBeTruthy()
		expect(screen.getByTestId('weight-card').textContent).toBe('')
	})

	it('keeps the meal face when a meal comes with the weigh-in', () => {
		const { container } = render(
			<KusikReply
				message={createReply({ meals: MEALS, measurements: WEIGHT, content: '' })}
				today={TODAY}
				isLatest
			/>,
		)

		expect(getMood(container)).toBe('smile')
	})
})

describe('KusikReply achievements', () => {
	const kg = { id: 'a1', type: 'WEIGHT_KG_LOST', value: 3 }
	const streak = { id: 'a2', type: 'FOOD_STREAK', value: 7 }
	const toAchievements = (...items: object[]) => items as unknown as ChatMessage['achievements']

	it('puts the card under the meal cards of a reply with words', () => {
		render(
			<KusikReply
				message={createReply({ meals: MEALS, achievements: toAchievements(streak) })}
				today={TODAY}
				isLatest
			/>,
		)

		const meal = screen.getByTestId('meal-card')
		const card = screen.getByTestId('achievement-card')
		expect(card.textContent).toBe('FOOD_STREAK:7')
		expect(meal.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
	})

	it('shows only the kilograms card when the reply has both achievements', () => {
		render(
			<KusikReply
				message={createReply({ meals: MEALS, achievements: toAchievements(streak, kg) })}
				today={TODAY}
				isLatest
			/>,
		)

		expect(screen.getAllByTestId('achievement-card')).toHaveLength(1)
		expect(screen.getByTestId('achievement-card').textContent).toBe('WEIGHT_KG_LOST:3')
	})

	it('goes after the weight card of a bare weigh-in', () => {
		render(
			<KusikReply
				message={createReply({ measurements: WEIGHT, achievements: toAchievements(kg) })}
				today={TODAY}
				isLatest
			/>,
		)

		const weight = screen.getByTestId('weight-card')
		const card = screen.getByTestId('achievement-card')
		expect(weight.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
	})

	it('shows no card without achievements', () => {
		render(<KusikReply message={createReply({ meals: MEALS })} today={TODAY} isLatest />)

		expect(screen.queryByTestId('achievement-card')).toBeNull()
	})
})

describe('KusikReply face for an achievement', () => {
	const streak = [
		{ id: 'a2', type: 'FOOD_STREAK', value: 7 },
	] as unknown as ChatMessage['achievements']

	beforeEach(() => {
		vi.useFakeTimers()
		useFreshReplyStore.setState({ ownerId: null, freshAt: {} })
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('a fresh achievement turns the face from smile to happy once the card has popped', () => {
		useFreshReplyStore.setState({ freshAt: { 'achievement:a2': Date.now() } })
		const { container } = render(
			<KusikReply
				message={createReply({ meals: MEALS, achievements: streak })}
				today={TODAY}
				isLatest
			/>,
		)
		expect(getMood(container)).toBe('smile')

		act(() => {
			vi.advanceTimersByTime(400)
		})
		expect(getMood(container)).toBe('happy')
	})

	it('an achievement from the history keeps the usual face', () => {
		const { container } = render(
			<KusikReply
				message={createReply({ meals: MEALS, achievements: streak })}
				today={TODAY}
				isLatest
			/>,
		)

		act(() => {
			vi.advanceTimersByTime(1000)
		})
		expect(getMood(container)).toBe('smile')
	})

	it('a fresh bare weigh-in with an achievement is happy, without one it stays proud', () => {
		useFreshReplyStore.setState({ freshAt: { 'achievement:a2': Date.now() } })
		const withAchievement = render(
			<KusikReply
				message={createReply({ measurements: WEIGHT, achievements: streak })}
				today={TODAY}
				isLatest
			/>,
		)
		act(() => {
			vi.advanceTimersByTime(400)
		})
		expect(getMood(withAchievement.container)).toBe('happy')
		cleanup()

		const plain = render(
			<KusikReply message={createReply({ measurements: WEIGHT })} today={TODAY} isLatest />,
		)
		expect(getMood(plain.container)).toBe('proud')
	})
})
