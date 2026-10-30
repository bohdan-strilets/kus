import type { ChatMessage, SendMessageResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { makeExercise, makeWorkout } from '@/shared/testing'

import { getReplySound } from './get-reply-sound'

const message = (overrides: Partial<ChatMessage>): ChatMessage => ({
	id: '0199b3a4-0000-7000-8000-000000000010',
	role: 'USER',
	content: 'тарілка супу',
	status: 'COMPLETED',
	clientMessageId: '0199b3a4-0000-7000-8000-0000000000aa',
	replyToId: null,
	createdAt: '2026-10-07T12:00:00.000Z',
	meals: [],
	clarifications: [],
	measurements: [],
	workouts: [],
	achievements: [],
	dayCard: null,
	statsCard: null,
	savedFoods: [],
	factProposal: null,
	photo: null,
	...overrides,
})

const MEALS = [{ id: 'meal-1' }] as unknown as ChatMessage['meals']
const OPEN = [{ status: 'OPEN' }] as unknown as ChatMessage['clarifications']
const MEASUREMENTS = [{ id: 'w-1' }] as unknown as ChatMessage['measurements']
const ACHIEVEMENTS = [{ id: 'a-1' }] as unknown as ChatMessage['achievements']
const ANSWERED = [{ status: 'ANSWERED' }] as unknown as ChatMessage['clarifications']

const turn = (
	reply: Partial<ChatMessage>,
	user: Partial<ChatMessage> = {},
): Pick<SendMessageResponse, 'userMessage' | 'assistantMessage'> => ({
	userMessage: message(user),
	assistantMessage: message({ role: 'ASSISTANT', clientMessageId: null, ...reply }),
})

describe('getReplySound', () => {
	it('plays «kusik» when the reply logged meals', () => {
		expect(getReplySound(turn({ meals: MEALS }))).toBe('kusik')
	})

	it('is silent for a plain reply without meals', () => {
		expect(getReplySound(turn({}))).toBeNull()
	})

	it('plays «clarify» for an open question, even with a best-guess meal logged', () => {
		expect(getReplySound(turn({ meals: MEALS, clarifications: OPEN }))).toBe('clarify')
	})

	it('plays «clarify» for an open question without meals', () => {
		expect(getReplySound(turn({ clarifications: OPEN }))).toBe('clarify')
	})

	it('treats an answered clarification as done: «kusik» for the meals', () => {
		expect(getReplySound(turn({ meals: MEALS, clarifications: ANSWERED }))).toBe('kusik')
	})

	it('is silent for an answered clarification without meals', () => {
		expect(getReplySound(turn({ clarifications: ANSWERED }))).toBeNull()
	})

	it('plays «photoFail» for a failed photo, outranking meals', () => {
		expect(getReplySound(turn({ meals: MEALS }, { photo: { status: 'FAILED' } }))).toBe('photoFail')
	})

	it('plays «photoFail» outranking an open question', () => {
		expect(getReplySound(turn({ clarifications: OPEN }, { photo: { status: 'FAILED' } }))).toBe(
			'photoFail',
		)
	})
	it('plays «saved» for a bare weigh-in', () => {
		expect(getReplySound(turn({ measurements: MEASUREMENTS }))).toBe('saved')
	})

	it('plays «kusik», not «saved», when a meal comes with the weigh-in', () => {
		expect(getReplySound(turn({ meals: MEALS, measurements: MEASUREMENTS }))).toBe('kusik')
	})

	it('plays «achieve» for an achievement, outranking meals and a weigh-in', () => {
		expect(
			getReplySound(turn({ achievements: ACHIEVEMENTS, meals: MEALS, measurements: MEASUREMENTS })),
		).toBe('achieve')
	})

	it('plays «achieve» over an open question', () => {
		expect(getReplySound(turn({ achievements: ACHIEVEMENTS, clarifications: OPEN }))).toBe(
			'achieve',
		)
	})

	it('lets a failed photo outrank an achievement', () => {
		expect(
			getReplySound(turn({ achievements: ACHIEVEMENTS }, { photo: { status: 'FAILED' } })),
		).toBe('photoFail')
	})

	it('plays «achieve» for a workout with a record, silent for a plain workout', () => {
		const record = [makeWorkout({ exercises: [makeExercise({ record: 'WEIGHT' })] })]

		expect(getReplySound(turn({ workouts: record }))).toBe('achieve')
		expect(getReplySound(turn({ workouts: [makeWorkout()] }))).toBeNull()
	})
})
