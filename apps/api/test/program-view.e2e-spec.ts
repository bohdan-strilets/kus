import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	authSessionResponseSchema,
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
	createDataResponseSchema,
	sendMessageResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createCompletion, createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const sendResponse = createDataResponseSchema(sendMessageResponseSchema)
const feedResponse = createCursorPaginatedResponseSchema(chatMessageSchema)
const fake = createFakeAiClient()

const REPLY_TEXT = 'Ось твоя програма.'

const propose = {
	name: 'propose_program',
	args: {
		mode: 'ROTATE',
		perWeek: 2,
		templates: [
			{
				ref: null,
				name: 'Тренування А',
				exercises: [
					{ name: 'Жим лежачи', kind: 'STRENGTH', sets: 3, repsMin: 8, repsMax: 12, weightKg: 60 },
				],
			},
			{
				ref: null,
				name: 'Тренування Б',
				exercises: [
					{ name: 'Присідання', kind: 'STRENGTH', sets: 3, repsMin: 8, repsMax: 8, weightKg: 80 },
				],
			},
		],
		reply: 'Два тренування.',
	},
}

interface TestUser {
	agent: TestAgent
}

describe('reply attach program (e2e, real DB, fake model)', () => {
	let app: NestExpressApplication
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]

	const start = async (): Promise<void> => {
		fake.reset()
		;({ app } = await createDbTestApp({ aiClient: fake.client }))
	}

	const registerUser = async (email: string): Promise<TestUser> => {
		const agent = request.agent(app.getHttpServer())
		const response = await agent
			.post('/api/v1/auth/register')
			.send({ email, password: 'correct-horse-battery', name: 'Test', consent: true })
			.expect(201)
		createDataResponseSchema(authSessionResponseSchema).parse(response.body)
		return { agent }
	}

	const send = async (user: TestUser, text: string, args: Record<string, unknown>) => {
		fake.respond(createCompletion([{ name: 'reply', args }]))
		const response = await user.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text })
			.expect(201)
		return sendResponse.parse(response.body).data.assistantMessage
	}

	const feedMessage = async (user: TestUser, id: string) => {
		const feed = feedResponse.parse((await user.agent.get(MESSAGES_URL).expect(200)).body)
		return feed.data.find((message) => message.id === id)
	}

	/** A program proposed in the chat and accepted. */
	const seedProgram = async (user: TestUser): Promise<void> => {
		fake.respond(createCompletion([propose]))
		const response = await user.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text: 'склади програму' })
			.expect(201)
		const { id } = sendResponse.parse(response.body).data.assistantMessage
		await user.agent.post(`/api/v1/programs/proposals/${id}/accept`).expect(201)
	}

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('attaches the active program to the reply, in the response and in the feed', async () => {
		await start()
		const user = await registerUser('view-owner@kus.app')
		await seedProgram(user)

		const message = await send(user, 'покажи програму', { text: REPLY_TEXT, attach: 'program' })

		expect(message.content).toBe(REPLY_TEXT)
		expect(message.programView).toMatchObject({ v: 1 })
		expect(message.programView?.program.templates.map(({ name }) => name)).toEqual([
			'Тренування А',
			'Тренування Б',
		])
		expect(message.programView?.nextTemplateKey).toBe(
			message.programView?.program.templates[0]?.key,
		)

		const stored = await feedMessage(user, message.id)
		expect(stored?.content).toBe(REPLY_TEXT)
		expect(stored?.programView).toEqual(message.programView)
	})

	it('keeps the text and no card when the user has no program', async () => {
		await start()
		const user = await registerUser('view-none@kus.app')

		const message = await send(user, 'покажи програму', { text: REPLY_TEXT, attach: 'program' })

		expect(message.content).toBe(REPLY_TEXT)
		expect(message.programView).toBeNull()
		expect((await feedMessage(user, message.id))?.programView).toBeNull()
	})

	it("never shows another user's program (IDOR)", async () => {
		await start()
		const owner = await registerUser('view-idor-owner@kus.app')
		const stranger = await registerUser('view-idor-stranger@kus.app')
		await seedProgram(owner)

		const message = await send(stranger, 'покажи програму', { text: REPLY_TEXT, attach: 'program' })

		expect(message.content).toBe(REPLY_TEXT)
		expect(message.programView).toBeNull()
		expect((await feedMessage(stranger, message.id))?.programView).toBeNull()
	})

	it('gives no card to a reply without attach even when a program exists', async () => {
		await start()
		const user = await registerUser('view-plain@kus.app')
		await seedProgram(user)

		const message = await send(user, 'привіт', { text: 'Привіт!' })

		expect(message.content).toBe('Привіт!')
		expect(message.programView).toBeNull()
		expect((await feedMessage(user, message.id))?.programView).toBeNull()
	})

	it('does not follow a later edit: the card is a snapshot', async () => {
		await start()
		const user = await registerUser('view-snapshot@kus.app')
		await seedProgram(user)
		const message = await send(user, 'покажи програму', { text: REPLY_TEXT, attach: 'program' })

		await user.agent.delete('/api/v1/programs/active').expect(204)

		expect((await feedMessage(user, message.id))?.programView).toEqual(message.programView)
	})
})
