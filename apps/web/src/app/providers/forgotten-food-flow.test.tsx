// @vitest-environment jsdom
import type { ChatMessage } from '@kus/shared'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useForgottenFoodsStore } from '@/entities/my-food'
import { useSendMessage } from '@/features/send-message'
import { useForgottenFoodToast } from '@/features/undo-forget-food'
import { httpClient } from '@/shared/api'
import { renderWithProviders } from '@/shared/testing'

const CLIENT_ID = '0199b3a4-0000-7000-8000-0000000000aa'
const USER_ID = '0199b3a4-0000-7000-8000-000000000010'
const ASSISTANT_ID = '0199b3a4-0000-7000-8000-000000000011'
const FOOD_ID = '0199b3a4-0000-7000-8000-0000000000f1'

const message = (overrides: Partial<ChatMessage>): ChatMessage => ({
	id: USER_ID,
	role: 'USER',
	content: 'забудь кабаноси',
	status: 'COMPLETED',
	clientMessageId: CLIENT_ID,
	replyToId: null,
	createdAt: '2026-10-07T12:00:00.000Z',
	meals: [],
	clarifications: [],
	measurements: [],
	workouts: [],
	workoutCards: [],
	achievements: [],
	dayCard: null,
	statsCard: null,
	programCard: null,
	programCardState: null,
	programView: null,
	trainingOnboarding: null,
	trainingOnboardingState: null,
	savedFoods: [],
	forgottenFoods: [],
	factProposal: null,
	photo: null,
	...overrides,
})

const reply = {
	data: {
		userMessage: message({}),
		assistantMessage: message({
			id: ASSISTANT_ID,
			role: 'ASSISTANT',
			content: 'Прибрав!',
			clientMessageId: null,
			replyToId: USER_ID,
			forgottenFoods: [{ id: FOOD_ID, name: 'Кабаноси' }],
		}),
		dayTotals: {
			localDate: '2026-10-07',
			totals: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
			goalKcal: null,
			remainingKcal: null,
		},
		updatedMessages: [],
		hasNewWorkoutRecord: false,
	},
}

const Chat = () => {
	useForgottenFoodToast()
	const { send } = useSendMessage()
	return (
		<button
			type="button"
			onClick={() => {
				send({ text: 'забудь кабаноси' })
			}}
		>
			send
		</button>
	)
}

beforeEach(() => {
	MotionGlobalConfig.skipAnimations = true
	useForgottenFoodsStore.setState({ foods: [] })
})

afterEach(() => {
	MotionGlobalConfig.skipAnimations = false
	vi.restoreAllMocks()
	cleanup()
})

describe('forgotten food: reply to toast', () => {
	it('parses the real response and shows the undo toast', async () => {
		const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: reply })
		renderWithProviders(<Chat />)

		fireEvent.click(screen.getByText('send'))

		expect(await screen.findByText("Прибрав «Кабаноси» з пам'яті")).not.toBeNull()
		expect(screen.getByRole('button', { name: 'Скасувати' })).not.toBeNull()
		expect(post).toHaveBeenCalledTimes(1)
	})
})
