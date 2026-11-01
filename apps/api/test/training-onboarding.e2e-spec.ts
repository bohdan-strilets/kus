import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	type ChatMessage,
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
	createDataResponseSchema,
	sendMessageResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import {
	createCompletion,
	createFakeAiClient,
	type FakeToolCall,
} from '../src/modules/ai/ai.test-utils'
import { Prisma } from '../src/generated/prisma/client'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const START_URL = '/api/v1/programs/onboarding/start'
const DISMISS_URL = '/api/v1/programs/onboarding/dismiss'

const sendResponse = createDataResponseSchema(sendMessageResponseSchema)
const messageResponse = createDataResponseSchema(chatMessageSchema)
const feedResponse = createCursorPaginatedResponseSchema(chatMessageSchema)
const fake = createFakeAiClient()

const workoutCall: FakeToolCall = {
	name: 'log_workout',
	args: {
		exercises: [
			{ name: 'Жим лежачи', kind: 'STRENGTH', sets: [{ reps: 8, weightKg: 60, count: 3 }] },
		],
		reply: 'Записав тренування.',
	},
}
const replyCall = (text: string): FakeToolCall => ({ name: 'reply', args: { text } })
const proposeCall: FakeToolCall = {
	name: 'propose_program',
	args: {
		mode: 'ROTATE',
		perWeek: 3,
		reply: 'Ось програма на три тренування.',
		templates: [
			{
				ref: null,
				name: 'Тренування А',
				exercises: [{ name: 'Жим лежачи', kind: 'STRENGTH', sets: 3, repsMin: 8, repsMax: 12 }],
			},
		],
	},
}

interface TestUser {
	agent: TestAgent
	userId: string
}

describe('training onboarding in the chat (e2e, real DB, fake model)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]

	const start = async (): Promise<void> => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
	}

	const registerUser = async (email: string): Promise<TestUser> => {
		const agent = request.agent(app.getHttpServer())
		const response = await agent
			.post('/api/v1/auth/register')
			.send({ email, password: 'correct-horse-battery', name: 'Test', consent: true })
			.expect(201)
		const { user } = createDataResponseSchema(authSessionResponseSchema).parse(response.body).data
		return { agent, userId: user.id }
	}

	const sendText = async (user: TestUser, text: string, call: FakeToolCall) => {
		fake.respond(createCompletion([call]))
		const response = await user.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text })
			.expect(201)
		return sendResponse.parse(response.body).data
	}

	const answer = (
		user: TestUser,
		{ messageId, values, text }: { messageId: string; values: string[]; text: string },
	) =>
		user.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text, onboardingAnswer: { messageId, values } })

	const tap = async (
		user: TestUser,
		params: { messageId: string; values: string[]; text: string },
	) => sendResponse.parse((await answer(user, params).expect(201)).body).data

	const startOnboarding = async (user: TestUser): Promise<ChatMessage> =>
		messageResponse.parse((await user.agent.post(START_URL).expect(201)).body).data

	const findInFeed = async (user: TestUser, id: string): Promise<ChatMessage | undefined> => {
		const feed = feedResponse.parse((await user.agent.get(MESSAGES_URL).expect(200)).body)
		return feed.data.find((message) => message.id === id)
	}

	const errorCode = (body: unknown): string => apiErrorResponseSchema.parse(body).errorCode

	const modelMessageCount = async (userId: string): Promise<number> => {
		const usage = await prisma.dailyUsage.findFirst({ where: { userId } })
		return usage?.messageCount ?? 0
	}

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('asks the first question once for a double tap on «Налаштувати в чаті» after «Пізніше»', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await owner.agent.post(DISMISS_URL).expect(204)

		const responses = await Promise.all([owner.agent.post(START_URL), owner.agent.post(START_URL)])

		expect(responses.map(({ status }) => status)).toEqual([201, 201])
		const [first, second] = responses.map(({ body }) => messageResponse.parse(body).data)
		expect(first?.id).toBe(second?.id)
		expect(
			await prisma.message.count({
				where: { userId: owner.userId, trainingOnboarding: { not: Prisma.DbNull } },
			}),
		).toBe(1)
	})

	it('invites after the first workout; «Пізніше» closes it for good', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const first = await sendText(owner, 'жим 3×8 по 60', workoutCall)

		expect(first.assistantMessage.content).toBe('Записав тренування.')
		expect(first.assistantMessage.trainingOnboarding).toEqual({
			v: 1,
			step: 0,
			preselected: [],
			answer: null,
		})
		expect(first.assistantMessage.trainingOnboardingState).toBe('OPEN')

		await owner.agent.post(DISMISS_URL).expect(204)

		expect((await findInFeed(owner, first.assistantMessage.id))?.trainingOnboardingState).toBe(
			'CLOSED',
		)
		const profile = await prisma.userProfile.findUniqueOrThrow({
			where: { userId: owner.userId },
		})
		expect(profile.trainingOnboardingAt).not.toBeNull()

		// the only workout gone, a new one is the first again — but «Пізніше» was said
		await prisma.workout.updateMany({
			where: { userId: owner.userId },
			data: { deletedAt: new Date() },
		})
		await prisma.message.updateMany({
			where: { id: first.assistantMessage.id },
			data: { trainingOnboarding: Prisma.DbNull },
		})
		const again = await sendText(owner, 'жим 3×8 по 60', workoutCall)
		expect(again.assistantMessage.trainingOnboarding).toBeNull()
	})

	it('does not invite when the user already has a workout', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await prisma.workout.create({
			data: { userId: owner.userId, localDate: new Date('2026-10-01T00:00:00Z') },
		})

		const turn = await sendText(owner, 'жим 3×8 по 60', workoutCall)

		expect(turn.assistantMessage.trainingOnboarding).toBeNull()
	})

	it('asks five questions without the model, then the model proposes a program from the answers', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const q1 = await startOnboarding(owner)
		expect(q1).toMatchObject({
			role: 'ASSISTANT',
			content: null,
			replyToId: null,
			trainingOnboarding: { v: 1, step: 1, preselected: [], answer: null },
			trainingOnboardingState: 'OPEN',
		})
		// a second tap returns the open question instead of asking again
		expect((await startOnboarding(owner)).id).toBe(q1.id)

		const afterQ1 = await tap(owner, { messageId: q1.id, values: ['GYM'], text: 'Зал' })
		expect(afterQ1.userMessage.content).toBe('Зал')
		expect(afterQ1.assistantMessage.trainingOnboarding).toMatchObject({ step: 2, answer: null })
		expect(afterQ1.updatedMessages).toEqual([
			expect.objectContaining({ id: q1.id, trainingOnboardingState: 'ANSWERED' }),
		])
		expect(afterQ1.updatedMessages[0]?.trainingOnboarding?.answer).toEqual(['GYM'])

		const afterQ2 = await tap(owner, {
			messageId: afterQ1.assistantMessage.id,
			values: ['STRENGTH_AND_CARDIO'],
			text: 'Силові й кардіо',
		})
		const afterQ3 = await tap(owner, {
			messageId: afterQ2.assistantMessage.id,
			values: ['EXPERIENCED'],
			text: 'Є досвід',
		})
		const afterQ4 = await tap(owner, {
			messageId: afterQ3.assistantMessage.id,
			values: ['3'],
			text: '3',
		})
		// «Зал» on the first question ticks «Повний зал»
		expect(afterQ4.assistantMessage.trainingOnboarding).toEqual({
			v: 1,
			step: 5,
			preselected: ['FULL_GYM'],
			answer: null,
		})
		// four answers, no model call and nothing spent from the daily AI budget
		expect(fake.bodies).toHaveLength(0)
		expect(await modelMessageCount(owner.userId)).toBe(0)

		fake.respond(createCompletion([proposeCall]))
		const afterQ5 = await tap(owner, {
			messageId: afterQ4.assistantMessage.id,
			values: ['FULL_GYM', 'PULL_UP_BAR'],
			text: 'Повний зал, Турнік',
		})

		expect(fake.bodies).toHaveLength(1)
		const q5Body = JSON.stringify(fake.bodies[0])
		expect(q5Body).toContain(
			'Onboarding answers: place GYM; usually STRENGTH_AND_CARDIO; level EXPERIENCED; 3 per week; equipment FULL_GYM, PULL_UP_BAR. Propose a program for them with propose_program.',
		)
		// the answers to questions 1–4 come only as «Onboarding answers», never as history turns
		expect(q5Body).not.toContain('Силові й кардіо')
		expect(q5Body).not.toContain('Є досвід')
		expect(q5Body).toContain('Повний зал, Турнік')
		expect(afterQ5.assistantMessage.content).toBe('Ось програма на три тренування.')
		expect(afterQ5.assistantMessage.programCard).toMatchObject({ v: 1, baseVersionId: null })
		expect(await modelMessageCount(owner.userId)).toBe(1)
		expect(
			(await findInFeed(owner, afterQ4.assistantMessage.id))?.trainingOnboarding,
		).toMatchObject({ answer: ['FULL_GYM', 'PULL_UP_BAR'] })

		// a closed question takes no more answers
		const late = await answer(owner, { messageId: q1.id, values: ['HOME'], text: 'Вдома' }).expect(
			409,
		)
		expect(errorCode(late.body)).toBe('TRAINING_ONBOARDING_CLOSED')

		// a later ordinary turn: still no answer of questions 1–4 in the history
		await sendText(owner, 'дякую', replyCall('Будь ласка.'))
		const laterBody = JSON.stringify(fake.bodies[1])
		expect(laterBody).not.toContain('Силові й кардіо')
		expect(laterBody).not.toContain('Є досвід')
		expect(laterBody).toContain('Ось програма на три тренування.')
	})

	it('takes words that match a button as the answer; other words end the onboarding', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const q1 = await startOnboarding(owner)

		const fromWords = await owner.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text: 'вдома!' })
			.expect(201)
		const afterQ1 = sendResponse.parse(fromWords.body).data
		expect(fake.bodies).toHaveLength(0)
		expect(afterQ1.assistantMessage.trainingOnboarding).toMatchObject({ step: 2, preselected: [] })
		expect((await findInFeed(owner, q1.id))?.trainingOnboarding).toMatchObject({
			answer: ['HOME'],
		})

		const q2 = afterQ1.assistantMessage
		const other = await sendText(owner, 'а що краще для спини?', replyCall('Розкажу.'))
		expect(fake.bodies).toHaveLength(1)
		// the words that answered question 1 are not a history turn either
		expect(JSON.stringify(fake.bodies[0])).not.toContain('вдома!')
		expect(other.assistantMessage.content).toBe('Розкажу.')
		expect(other.updatedMessages).toEqual([
			expect.objectContaining({ id: q2.id, trainingOnboardingState: 'CLOSED' }),
		])

		// a label of the closed question is an ordinary message now
		await sendText(owner, 'силові', replyCall('Добре.'))
		expect(fake.bodies).toHaveLength(2)
		const closed = await answer(owner, {
			messageId: q2.id,
			values: ['STRENGTH'],
			text: 'Силові',
		}).expect(409)
		expect(errorCode(closed.body)).toBe('TRAINING_ONBOARDING_CLOSED')
	})

	it("refuses another user's question and a value of another question", async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		const q1 = await startOnboarding(owner)

		const foreign = await answer(stranger, {
			messageId: q1.id,
			values: ['GYM'],
			text: 'Зал',
		}).expect(404)
		expect(errorCode(foreign.body)).toBe('TRAINING_ONBOARDING_NOT_FOUND')

		const wrong = await answer(owner, {
			messageId: q1.id,
			values: ['DUMBBELLS'],
			text: 'Гантелі',
		}).expect(422)
		expect(errorCode(wrong.body)).toBe('VALIDATION_ERROR')
		// nothing was written for either: the question is still open
		expect((await findInFeed(owner, q1.id))?.trainingOnboardingState).toBe('OPEN')
		expect(
			await prisma.message.count({
				where: { userId: { in: [owner.userId, stranger.userId] }, role: 'USER' },
			}),
		).toBe(0)
	})
})
