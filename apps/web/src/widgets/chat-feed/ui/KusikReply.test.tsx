// @vitest-environment jsdom
import type { ChatMessage } from '@kus/shared'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGoalCelebrationStore } from '@/entities/stats'

import { KusikReply } from './KusikReply'

vi.mock('./MealCard', () => ({ MealCard: () => null }))

const REPLY_ID = '0199b3a4-0000-7000-8000-000000000011'
const OTHER_ID = '0199b3a4-0000-7000-8000-000000000022'

const createReply = (overrides: Partial<ChatMessage> = {}): ChatMessage =>
	// only the fields KusikReply reads
	({
		id: REPLY_ID,
		replyToId: '0199b3a4-0000-7000-8000-000000000001',
		content: 'ok',
		meals: [],
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
		const { container } = render(<KusikReply message={createReply()} isLatest />)
		expect(getMood(container)).toBe('smile')
	})

	it('is happy when this reply closed the day goal', () => {
		const { container } = render(<KusikReply message={createReply()} isLatest />)
		reveal(REPLY_ID)
		expect(getMood(container)).toBe('happy')
	})

	it('stays unchanged when the goal was closed by another reply', () => {
		const { container } = render(<KusikReply message={createReply()} isLatest />)
		reveal(OTHER_ID)
		expect(getMood(container)).toBe('smile')
	})

	it('lets an open clarification win over the goal', () => {
		const message = createReply({
			clarifications: [{ id: 'q1', status: 'OPEN' }] as unknown as ChatMessage['clarifications'],
		})
		const { container } = render(<KusikReply message={message} isLatest />)
		reveal(REPLY_ID)
		expect(getMood(container)).toBe('smile')
	})

	it('lets a failed photo win over the goal', () => {
		const { container } = render(
			<KusikReply message={createReply()} isLatest photoStatus="FAILED" />,
		)
		reveal(REPLY_ID)
		expect(getMood(container)).toBe('oops')
	})
})
