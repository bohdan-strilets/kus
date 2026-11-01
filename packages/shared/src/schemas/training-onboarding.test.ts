import { describe, expect, it } from 'vitest'

import { formatOnboardingAnswers } from '../ai/program-onboarding.js'
import { chatMessageSchema, sendMessageRequestSchema } from './messages.js'
import {
	isValidOnboardingAnswer,
	onboardingAnswerRequestSchema,
	trainingOnboardingSchema,
} from './training-onboarding.js'

const QUESTION_ID = '00000000-0000-4000-8000-000000000001'

describe('isValidOnboardingAnswer', () => {
	it('takes exactly one known value on the single-choice questions', () => {
		expect(isValidOnboardingAnswer(1, ['GYM'])).toBe(true)
		expect(isValidOnboardingAnswer(4, ['5+'])).toBe(true)
		expect(isValidOnboardingAnswer(1, ['GYM', 'HOME'])).toBe(false)
		expect(isValidOnboardingAnswer(2, [])).toBe(false)
		// a value of another question
		expect(isValidOnboardingAnswer(3, ['GYM'])).toBe(false)
	})

	it('takes 1–5 equipment values, «Нічого» only alone, no repeats', () => {
		expect(isValidOnboardingAnswer(5, ['FULL_GYM', 'PULL_UP_BAR'])).toBe(true)
		expect(isValidOnboardingAnswer(5, ['NONE'])).toBe(true)
		expect(isValidOnboardingAnswer(5, ['NONE', 'BANDS'])).toBe(false)
		expect(isValidOnboardingAnswer(5, ['BANDS', 'BANDS'])).toBe(false)
	})
})

describe('trainingOnboardingSchema', () => {
	it('reads an invitation and an answered question', () => {
		expect(
			trainingOnboardingSchema.safeParse({ v: 1, step: 0, preselected: [], answer: null }).success,
		).toBe(true)
		expect(
			trainingOnboardingSchema.safeParse({
				v: 1,
				step: 5,
				preselected: ['FULL_GYM'],
				answer: ['FULL_GYM', 'DUMBBELLS'],
			}).success,
		).toBe(true)
	})

	it('refuses an answer on the invitation, a foreign value and an unknown step', () => {
		const invalid = [
			{ v: 1, step: 0, preselected: [], answer: ['GYM'] },
			{ v: 1, step: 1, preselected: ['FULL_GYM'], answer: null },
			{ v: 1, step: 2, preselected: [], answer: ['GYM'] },
			{ v: 1, step: 6, preselected: [], answer: null },
			{ v: 2, step: 1, preselected: [], answer: null },
		]
		for (const payload of invalid) {
			expect(trainingOnboardingSchema.safeParse(payload).success).toBe(false)
		}
	})

	it('drops an unreadable payload from a chat message instead of failing the message', () => {
		const message = chatMessageSchema.parse({
			id: QUESTION_ID,
			role: 'ASSISTANT',
			content: null,
			status: 'COMPLETED',
			clientMessageId: null,
			replyToId: null,
			createdAt: '2026-11-01T10:00:00.000Z',
			photo: null,
			meals: [],
			clarifications: [],
			measurements: [],
			achievements: [],
			trainingOnboarding: { v: 1, step: 9 },
			trainingOnboardingState: 'SOMETHING',
		})
		expect(message.trainingOnboarding).toBeNull()
		expect(message.trainingOnboardingState).toBeNull()
	})
})

describe('onboardingAnswerRequestSchema', () => {
	it('takes known values without repeats, «Нічого» alone', () => {
		expect(
			onboardingAnswerRequestSchema.safeParse({ messageId: QUESTION_ID, values: ['HOME'] }).success,
		).toBe(true)
		for (const values of [[], ['SOFA'], ['BANDS', 'BANDS'], ['NONE', 'BANDS']]) {
			expect(
				onboardingAnswerRequestSchema.safeParse({ messageId: QUESTION_ID, values }).success,
			).toBe(false)
		}
	})

	it('needs the label text and no photos next to it in POST /messages', () => {
		const base = {
			clientMessageId: '00000000-0000-4000-8000-000000000002',
			onboardingAnswer: { messageId: QUESTION_ID, values: ['GYM'] },
		}
		expect(sendMessageRequestSchema.safeParse({ ...base, text: 'Зал' }).success).toBe(true)
		expect(sendMessageRequestSchema.safeParse(base).success).toBe(false)
		expect(
			sendMessageRequestSchema.safeParse({
				...base,
				text: 'Зал',
				photoIds: ['00000000-0000-4000-8000-000000000003'],
			}).success,
		).toBe(false)
	})
})

describe('formatOnboardingAnswers', () => {
	it('writes the answers as c6 §3 shows them', () => {
		expect(
			formatOnboardingAnswers({
				place: 'GYM',
				activity: 'STRENGTH_AND_CARDIO',
				level: 'EXPERIENCED',
				perWeek: '3',
				equipment: ['FULL_GYM', 'PULL_UP_BAR'],
			}),
		).toBe(
			'place GYM; usually STRENGTH_AND_CARDIO; level EXPERIENCED; 3 per week; equipment FULL_GYM, PULL_UP_BAR',
		)
		expect(
			formatOnboardingAnswers({
				place: 'HOME',
				activity: 'NOTHING_YET',
				level: 'BEGINNER',
				perWeek: '5+',
				equipment: ['NONE'],
			}),
		).toContain('5+ per week')
	})
})
