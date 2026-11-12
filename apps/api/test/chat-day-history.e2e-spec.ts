import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { authSessionResponseSchema, createDataResponseSchema } from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { addDays, getDayHistoryStart, getLocalDate } from '../src/common/time'
import {
	createCompletion,
	createFakeAiClient,
	type FakeToolCall,
} from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const HOUR_MS = 60 * 60 * 1000
const TURNS = 13
const fake = createFakeAiClient()
const REPLY: FakeToolCall = { name: 'reply', args: { text: 'Дивлюсь' } }

interface TestUser {
	agent: TestAgent
	userId: string
	timezone: string
}

describe('the whole day of the chat reaches the model (e2e, real DB, fake model)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
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
		const { timezone } = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
		return { agent, userId: user.id, timezone }
	}

	const send = (user: TestUser, text: string) =>
		user.agent.post(MESSAGES_URL).send({ clientMessageId: randomUUID(), text })

	const getHistorySince = (user: TestUser): Date =>
		getDayHistoryStart(getLocalDate(new Date(), user.timezone), user.timezone)

	const seedUserMessage = (user: TestUser, content: string, createdAt: Date) =>
		prisma.message.create({
			data: {
				userId: user.userId,
				role: 'USER',
				content,
				status: 'COMPLETED',
				clientMessageId: randomUUID(),
				createdAt,
			},
		})

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('sends all 25 earlier messages of the day, not the last six', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		for (let turn = 1; turn <= TURNS; turn += 1) {
			fake.respond(createCompletion([REPLY]))
			await send(owner, `повідомлення номер ${turn}`).expect(201)
		}

		const lastBody = JSON.stringify(fake.bodies.at(-1))
		// 12 earlier turns = 24 messages, and the first of the 13th turn is the 25th
		for (let turn = 1; turn < TURNS; turn += 1) {
			expect(lastBody, `turn ${turn}`).toContain(`повідомлення номер ${turn}"`)
		}
		expect(fake.bodies).toHaveLength(TURNS)
	})

	it('marks a message of 21:00 yesterday that logged food as logged; 19:00 comes as the tail, unmarked', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const since = getHistorySince(owner)
		const yesterday = addDays(getLocalDate(new Date(), owner.timezone), -1)
		const dinner = await seedUserMessage(owner, 'вечеря вчора', new Date(since.getTime() + HOUR_MS))
		await seedUserMessage(owner, 'зовсім давно', new Date(since.getTime() - HOUR_MS))
		const meal = await prisma.meal.create({
			data: { userId: owner.userId, type: 'DINNER', localDate: yesterday, eatenAt: since },
		})
		await prisma.foodEntry.create({
			data: {
				userId: owner.userId,
				mealId: meal.id,
				sourceMessageId: dinner.id,
				name: 'Суп',
				grams: 300,
				kcal: 200,
				proteinG: 10,
				fatG: 5,
				carbsG: 20,
				source: 'ESTIMATE',
				confidence: 0.8,
				createdAt: new Date(since.getTime() + HOUR_MS),
			},
		})
		fake.respond(createCompletion([REPLY]))

		await send(owner, 'привіт').expect(201)

		const body = JSON.stringify(fake.bodies[0])
		expect(body).toContain('[logged] вечеря вчора')
		// before 20:00 it is the end of the day before, which has no logged entries here
		expect(body).toContain('зовсім давно')
		expect(body).not.toContain('[logged] зовсім давно')
	})

	it("never shows another user's messages", async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		const since = getHistorySince(stranger)
		await seedUserMessage(stranger, 'секрет сусіда', new Date(since.getTime() + HOUR_MS))
		await seedUserMessage(owner, 'мій вечір', new Date(since.getTime() + HOUR_MS))
		fake.respond(createCompletion([REPLY]))

		await send(owner, 'привіт').expect(201)

		const body = JSON.stringify(fake.bodies[0])
		expect(body).toContain('мій вечір')
		expect(body).not.toContain('секрет сусіда')
	})
})
