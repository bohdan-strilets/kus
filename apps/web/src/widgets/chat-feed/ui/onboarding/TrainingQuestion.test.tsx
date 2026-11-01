// @vitest-environment jsdom
import type { TrainingOnboardingState } from '@kus/shared'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'

import { TrainingQuestion } from './TrainingQuestion'

const send = vi.fn()
vi.mock('@/features/send-message', () => ({ useSendMessage: () => ({ send, retry: vi.fn() }) }))

const ID = '0199b3a4-0000-7000-8000-000000000011'

const renderQuestion = (
	step: 1 | 3 | 4 | 5,
	{
		state = 'OPEN',
		preselected = [],
		answer = null,
	}: { state?: TrainingOnboardingState; preselected?: string[]; answer?: string[] | null } = {},
) =>
	render(
		<TrainingQuestion
			messageId={ID}
			onboarding={{ v: 1, step, preselected, answer }}
			state={state}
		/>,
	)

afterEach(() => {
	cleanup()
	send.mockReset()
})

describe('TrainingQuestion', () => {
	it('sends the label of a chip with its value on one tap, once', () => {
		renderQuestion(1)

		fireEvent.click(screen.getByRole('button', { name: 'На вулиці' }))
		fireEvent.click(screen.getByRole('button', { name: 'Зал' }))

		expect(send).toHaveBeenCalledOnce()
		expect(send).toHaveBeenCalledWith({
			text: 'На вулиці',
			onboardingAnswer: { messageId: ID, values: ['OUTDOOR'] },
		})
	})

	it('shows the experience as rows with hints and sends the title', () => {
		renderQuestion(3)

		expect(screen.getByText('до пів року або після довгої перерви')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: /Є досвід/ }))
		expect(send).toHaveBeenCalledWith({
			text: 'Є досвід',
			onboardingAnswer: { messageId: ID, values: ['EXPERIENCED'] },
		})
	})

	it('waits for «Готово» on the equipment, with the preselected one ticked and «Нічого» exclusive', () => {
		renderQuestion(5, { preselected: ['FULL_GYM'] })

		const gym = screen.getByRole('button', { name: 'Повний зал' })
		expect(gym.getAttribute('aria-pressed')).toBe('true')
		fireEvent.click(screen.getByRole('button', { name: 'Турнік' }))
		expect(send).not.toHaveBeenCalled()

		fireEvent.click(screen.getByRole('button', { name: 'Нічого' }))
		expect(gym.getAttribute('aria-pressed')).toBe('false')
		fireEvent.click(screen.getByRole('button', { name: 'Гумки' }))
		fireEvent.click(screen.getByRole('button', { name: 'Готово' }))

		expect(send).toHaveBeenCalledWith({
			text: 'Гумки',
			onboardingAnswer: { messageId: ID, values: ['BANDS'] },
		})
	})

	it('cannot be finished with nothing ticked', () => {
		renderQuestion(5)
		expect(screen.getByRole('button', { name: 'Готово' }).hasAttribute('disabled')).toBe(true)
	})

	it('answered: the choice stays marked and nothing sends', () => {
		renderQuestion(4, { state: 'ANSWERED', answer: ['3'] })

		expect(screen.getByRole('button', { name: '3' }).getAttribute('aria-pressed')).toBe('true')
		fireEvent.click(screen.getByRole('button', { name: '2' }))
		expect(send).not.toHaveBeenCalled()
	})

	it('closed: only the question', () => {
		renderQuestion(4, { state: 'CLOSED' })

		expect(screen.getByText('Скільки разів на тиждень?')).toBeTruthy()
		expect(screen.queryByRole('button')).toBeNull()
	})
})
