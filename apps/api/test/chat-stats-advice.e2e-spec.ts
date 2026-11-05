import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	authSessionResponseSchema,
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
	createDataResponseSchema,
	sendMessageResponseSchema,
	STATS_EMPTY_REPLY,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { addDays, formatDbDate, getLocalDate } from '../src/common/time'
import { createCompletion, createFakeAiClient, logFoodCall } from '../src/modules/ai/ai.test-utils'
import { STATS_ADVICE_FAILED_REPLY } from '../src/modules/chat/chat.constants'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)
const listResponseSchema = createCursorPaginatedResponseSchema(chatMessageSchema)

const ADVICE_TEXT = 'Білка трохи не вистачає: додай сир чи яйця на сніданок.'
const WEIGHT_START_KG = 83.1
const WEIGHT_END_KG = 82.4

const fake = createFakeAiClient()

interface TestUser {
	agent: TestAgent
	userId: string
	timezone: string
}

interface FakeRequestBody {
	messages: { role: string; content: unknown; tool_calls?: { function: { name: string } }[] }[]
	tool_choice?: unknown
}

const showStats = (advice: boolean) => ({
	name: 'show_stats',
	args: { days: 7, endDate: null, reply: 'Ось тиждень', advice },
})

const adviceReply = { name: 'reply', args: { text: ADVICE_TEXT } }

const toDbDate = (date: string): Date => new Date(`${date}T00:00:00Z`)

describe('advice next to the stats card (e2e, real DB, fake model)', () => {
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

	const dayOffset = (user: TestUser, offset: number): string =>
		formatDbDate(addDays(getLocalDate(new Date(), user.timezone), offset))

	const seedEntry = async (user: TestUser, date: string, kcal: number): Promise<void> => {
		const meal = await prisma.meal.create({
			data: {
				userId: user.userId,
				type: 'DINNER',
				localDate: toDbDate(date),
				eatenAt: new Date(`${date}T17:00:00Z`),
			},
		})
		await prisma.foodEntry.create({
			data: {
				userId: user.userId,
				mealId: meal.id,
				name: 'Суп',
				grams: 300,
				kcal,
				proteinG: kcal / 25,
				fatG: kcal / 25,
				carbsG: kcal / 8,
				category: 'soup',
				source: 'LABEL',
				confidence: 0.9,
			},
		})
	}

	const seedWeight = async (user: TestUser, date: string, value: number): Promise<void> => {
		await prisma.measurement.create({
			data: {
				userId: user.userId,
				kind: 'WEIGHT',
				value,
				localDate: toDbDate(date),
				measuredAt: new Date(`${date}T08:00:00Z`),
				source: 'CHAT',
			},
		})
	}

	const seedWeek = async (user: TestUser): Promise<void> => {
		await seedEntry(user, dayOffset(user, -1), 1900)
		await seedEntry(user, dayOffset(user, -3), 2500)
		await seedWeight(user, dayOffset(user, -5), WEIGHT_START_KG)
		await seedWeight(user, dayOffset(user, -1), WEIGHT_END_KG)
	}

	const getBody = (index: number): FakeRequestBody => fake.bodies[index] as FakeRequestBody

	const getUsageCount = async (user: TestUser): Promise<number> =>
		(await prisma.dailyUsage.findFirstOrThrow({ where: { userId: user.userId } })).messageCount

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('makes a second call over the counted numbers and answers with its advice', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedWeek(owner)
		fake.respond(createCompletion([showStats(true)]), createCompletion([adviceReply]))

		const response = await send(owner, 'як тиждень і що порадиш').expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		expect(fake.bodies).toHaveLength(2)
		expect(data.assistantMessage.content).toBe(ADVICE_TEXT)
		expect(data.assistantMessage.statsCard).toMatchObject({ hasAdvice: true, loggedDays: 2 })
		// the weight is on the card but must not reach the model
		expect(data.assistantMessage.statsCard?.weightEndKg).toBe(WEIGHT_END_KG)

		const second = getBody(1)
		expect(second.tool_choice).toBe('auto')
		const assistantCall = second.messages.find((message) => message.role === 'assistant')
		expect(assistantCall?.tool_calls?.[0]?.function.name).toBe('show_stats')
		const toolMessage = second.messages.find((message) => message.role === 'tool')
		const toolText = String(toolMessage?.content)
		expect(toolText).toContain('already counted')
		expect(toolText).toContain('logged 2 of 7 days')
		expect(toolText).toContain('average 2 200 kcal')
		expect(toolText).not.toContain(String(WEIGHT_START_KG))
		expect(toolText).not.toContain(String(WEIGHT_END_KG))
		expect(toolText).not.toMatch(/weight|kg/i)

		const feed = listResponseSchema.parse((await owner.agent.get(MESSAGES_URL).expect(200)).body)
		const stored = feed.data.find(({ id }) => id === data.assistantMessage.id)
		expect(stored?.content).toBe(ADVICE_TEXT)
		expect(stored?.statsCard?.hasAdvice).toBe(true)

		expect(await prisma.aiRun.count()).toBe(2)
		expect(await getUsageCount(owner)).toBe(1)
	})

	it('keeps the card and says it in its own words when the second call fails', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedWeek(owner)
		fake.respond(createCompletion([showStats(true)]), new Error('network down'))

		const response = await send(owner, 'тиждень і поради').expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		expect(fake.bodies).toHaveLength(2)
		expect(data.assistantMessage.content).toBe(STATS_ADVICE_FAILED_REPLY)
		expect(data.assistantMessage.statsCard).toMatchObject({ hasAdvice: true, loggedDays: 2 })
		expect(await getUsageCount(owner)).toBe(1)
		const stored = await prisma.message.findFirstOrThrow({
			where: { id: data.assistantMessage.id },
		})
		expect(stored.content).toBe(STATS_ADVICE_FAILED_REPLY)
	})

	it('does not take a tool other than reply for the advice, and logs nothing from it', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedWeek(owner)
		const entriesBefore = await prisma.foodEntry.count()
		fake.respond(createCompletion([showStats(true)]), createCompletion([logFoodCall()]))

		const response = await send(owner, 'тиждень і поради').expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		expect(data.assistantMessage.content).toBe(STATS_ADVICE_FAILED_REPLY)
		expect(data.assistantMessage.statsCard?.hasAdvice).toBe(true)
		expect(await prisma.foodEntry.count()).toBe(entriesBefore)
	})

	it('makes one call and no advice flag without advice', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedWeek(owner)
		fake.respond(createCompletion([showStats(false)]))

		const { data } = sendResponseSchema.parse((await send(owner, 'як тиждень').expect(201)).body)

		expect(fake.bodies).toHaveLength(1)
		expect(data.assistantMessage.content).toBe('Ось тиждень')
		expect(data.assistantMessage.statsCard?.hasAdvice).toBe(false)
		expect(await prisma.aiRun.count()).toBe(1)
	})

	it('makes one call for an empty period: the fixed text, no card', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedEntry(owner, dayOffset(owner, -10), 300)
		fake.respond(createCompletion([showStats(true)]))

		const { data } = sendResponseSchema.parse(
			(await send(owner, 'тиждень, поради').expect(201)).body,
		)

		expect(fake.bodies).toHaveLength(1)
		expect(data.assistantMessage.content).toBe(STATS_EMPTY_REPLY)
		expect(data.assistantMessage.statsCard).toBeNull()
	})
})
