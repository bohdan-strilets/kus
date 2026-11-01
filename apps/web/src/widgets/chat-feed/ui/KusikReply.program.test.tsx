// @vitest-environment jsdom
import type { ChatMessage, ProgramCard, TrainingOnboardingState } from '@kus/shared'
import { cleanup, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { makeChatMessage, renderWithProviders } from '@/shared/testing'

import { KusikReply } from './KusikReply'

// the face of the avatar follows the reply kind: expose the kind itself
vi.mock('@/entities/message', async (importOriginal) => ({
	...(await importOriginal<object>()),
	KusikRow: ({ kind, children }: { kind?: string; children: ReactNode }) => (
		<div data-testid="kusik-row" data-kind={kind}>
			{children}
		</div>
	),
}))

const TODAY = '2026-11-01'
const EMPTY_TARGET = {
	sets: null,
	repsMin: null,
	repsMax: null,
	weightKg: null,
	progressStepKg: null,
	restSec: null,
	durationMin: null,
	distanceM: null,
}

const programCard: ProgramCard = {
	v: 1,
	baseVersionId: null,
	program: {
		title: null,
		mode: 'ROTATE',
		perWeek: 3,
		pinnedKey: null,
		templates: [
			{
				key: '0199b3a4-0000-7000-8000-000000000001',
				name: 'Тренування А',
				weekdays: [],
				estimatedMin: 55,
				exercises: [
					{
						name: 'Жим лежачи',
						exerciseId: null,
						kind: 'STRENGTH',
						muscleGroup: 'CHEST',
						target: { ...EMPTY_TARGET, sets: 3 },
					},
				],
			},
		],
	},
	changes: { v: 1, initial: true, lines: [], unchangedTemplates: 0 },
}

const invitation = (state: TrainingOnboardingState | null): Partial<ChatMessage> => ({
	trainingOnboarding: { v: 1, step: 0, preselected: [], answer: null },
	trainingOnboardingState: state,
})

afterEach(cleanup)

const renderReply = (overrides: Partial<ChatMessage>) =>
	renderWithProviders(<KusikReply message={makeChatMessage(overrides)} today={TODAY} isLatest />)

const getKind = (): string | null => screen.getByTestId('kusik-row').getAttribute('data-kind')

describe('KusikReply: program and training onboarding routing', () => {
	it('a program card without a user turn is a plain reply, not a welcome back', () => {
		renderReply({
			replyToId: null,
			programCard,
			programCardState: { status: 'OPEN', versionCreatedAt: null },
		})

		expect(getKind()).toBe('reply')
		expect(screen.getByRole('button', { name: 'Прийняти' })).toBeTruthy()
	})

	it('a training onboarding invitation without a user turn is not a welcome back either', () => {
		renderReply({ replyToId: null, ...invitation('OPEN') })

		expect(getKind()).toBe('reply')
	})

	it('a reply to nothing without any card is still the welcome back', () => {
		renderReply({ replyToId: null, content: 'З поверненням!' })

		expect(getKind()).toBe('welcomeBack')
	})

	it('shows the words above the program card when there are some', () => {
		renderReply({
			replyToId: null,
			content: 'Склав програму.',
			programCard,
			programCardState: { status: 'OPEN', versionCreatedAt: null },
		})

		expect(screen.getByText('Склав програму.')).toBeTruthy()
		expect(screen.getByText('Тренування А')).toBeTruthy()
	})

	it('the invitation shows «Так» / «Пізніше» while it is open', () => {
		renderReply({ replyToId: null, ...invitation('OPEN') })

		expect(screen.getByRole('button', { name: 'Так' })).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Пізніше' })).toBeTruthy()
	})

	it.each<TrainingOnboardingState | null>(['ANSWERED', 'CLOSED', null])(
		'the invitation hides its buttons when the state is %s',
		(state) => {
			renderReply({ replyToId: null, content: 'Привіт', ...invitation(state) })

			expect(screen.queryByRole('button', { name: 'Так' })).toBeNull()
			expect(screen.queryByRole('button', { name: 'Пізніше' })).toBeNull()
		},
	)
})
