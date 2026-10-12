// @vitest-environment jsdom
import type { ChatMessage } from '@kus/shared'
import { act, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGoalCelebrationStore } from '@/entities/stats'
import { renderHookWithProviders } from '@/shared/testing'

import { postClarificationAnswer } from '../api/answer-clarification'
import { useAnswerClarification } from './use-answer-clarification'

vi.mock('../api/answer-clarification', () => ({ postClarificationAnswer: vi.fn() }))

const answerMock = vi.mocked(postClarificationAnswer)
const ANSWER = { clarificationId: 'clarification-1', optionIndex: 0 }
// only what the hook reads: id and meals
const reply = { id: 'message-2', meals: [] } as unknown as ChatMessage

beforeEach(() => {
	answerMock.mockReset()
	useGoalCelebrationStore.setState({ armed: null, pending: null, ownerId: null })
})

afterEach(cleanup)

describe('useAnswerClarification', () => {
	it('arms the goal detector with the id of the returned message on success', async () => {
		answerMock.mockResolvedValue(reply)
		const { result } = renderHookWithProviders(() => useAnswerClarification())

		act(() => {
			result.current.answer(ANSWER)
		})

		await waitFor(() => {
			expect(useGoalCelebrationStore.getState().isArmed()).toBe(true)
		})
		expect(useGoalCelebrationStore.getState().armed?.messageId).toBe('message-2')
	})

	it('does not arm when the answer fails', async () => {
		answerMock.mockRejectedValue(new Error('boom'))
		const { result } = renderHookWithProviders(() => useAnswerClarification())

		act(() => {
			result.current.answer(ANSWER)
		})

		await waitFor(() => {
			expect(answerMock).toHaveBeenCalledTimes(1)
			expect(result.current.pending).toBeNull()
		})
		expect(useGoalCelebrationStore.getState().isArmed()).toBe(false)
		expect(useGoalCelebrationStore.getState().armed).toBeNull()
	})
})
