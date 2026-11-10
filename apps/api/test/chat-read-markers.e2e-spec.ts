import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { authSessionResponseSchema, createDataResponseSchema } from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import {
	createCompletion,
	createFakeAiClient,
	type FakeToolCall,
} from '../src/modules/ai/ai.test-utils'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const READ_MARKER = '[Kusik: read workouts'
const fake = createFakeAiClient()
const REPLY: FakeToolCall = { name: 'reply', args: { text: 'Дивлюсь' } }
const GET_WORKOUTS: FakeToolCall = { name: 'get_workouts', args: { days: 30 } }

describe('[Kusik: read …] history markers (e2e, real DB, fake model)', () => {
	let app: NestExpressApplication
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
	]

	const start = async (): Promise<void> => {
		fake.reset()
		;({ app } = await createDbTestApp({ aiClient: fake.client }))
	}

	const registerUser = async (email: string): Promise<TestAgent> => {
		const agent = request.agent(app.getHttpServer())
		const response = await agent
			.post('/api/v1/auth/register')
			.send({ email, password: 'correct-horse-battery', name: 'Test', consent: true })
			.expect(201)
		createDataResponseSchema(authSessionResponseSchema).parse(response.body)
		return agent
	}

	const send = (agent: TestAgent, text: string) =>
		agent.post(MESSAGES_URL).send({ clientMessageId: randomUUID(), text })

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it("puts the user's own read into the next request and never another user's", async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		// the stranger reads workouts (a digest is stored), the owner has no reads at all
		fake.respond(createCompletion([GET_WORKOUTS]), createCompletion([REPLY]))
		await send(stranger, 'коли я почав ходити в зал').expect(201)
		fake.respond(createCompletion([REPLY]))
		await send(owner, 'привіт').expect(201)
		fake.respond(createCompletion([REPLY]))
		await send(owner, 'як справи').expect(201)
		fake.respond(createCompletion([REPLY]))
		await send(stranger, 'ще питання').expect(201)

		const bodies = fake.bodies.map((body) => JSON.stringify(body))
		// 0-1: stranger's read turn; 2-3: the owner's turns; 4: the stranger's next turn
		expect(bodies).toHaveLength(5)
		expect(bodies[2]).not.toContain(READ_MARKER)
		expect(bodies[3]).not.toContain(READ_MARKER)
		expect(bodies[4]).toContain(READ_MARKER)
	})
})
