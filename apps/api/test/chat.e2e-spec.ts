import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
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
	EGGS_AND_BUCKWHEAT_ITEMS,
	INVALID_ITEM,
	logFoodCall,
	SOUP_ITEM,
	soupClarifyCall,
	TRUNCATED_COMPLETION,
} from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)
const listResponseSchema = createCursorPaginatedResponseSchema(chatMessageSchema)

const fake = createFakeAiClient()

interface TestUser {
	agent: TestAgent
	userId: string
}

describe('chat messages (e2e, real DB, fake model)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]

	const start = async (env: Record<string, string> = {}): Promise<void> => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client, env }))
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

	const send = (user: TestUser, text: string, clientMessageId: string = randomUUID()) =>
		user.agent.post(MESSAGES_URL).send({ clientMessageId, text })

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('logs food, sums on the backend and records the AI run', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([logFoodCall()], { costUsd: 0.004 }))

		const response = await send(owner, '3 варені яйця і 100 г гречки').expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		expect(data.userMessage.status).toBe('COMPLETED')
		expect(data.assistantMessage).toMatchObject({ role: 'ASSISTANT', content: 'Записав!' })
		const meal = data.assistantMessage.meals[0]
		expect(meal?.entries.map((entry) => entry.name)).toEqual(['Яйце варене', 'Гречка варена'])
		expect(meal?.totals).toEqual({ kcal: 343, protein: 23.1, fat: 17, carbs: 21.6, fiber: 2.7 })
		expect(data.dayTotals).toMatchObject({ totals: { kcal: 343 }, goalKcal: null })

		const entries = await prisma.foodEntry.findMany({ where: { userId: owner.userId } })
		expect(entries.every((entry) => entry.sourceMessageId === data.userMessage.id)).toBe(true)
		const runs = await prisma.aiRun.findMany({ include: { toolCalls: true } })
		expect(runs).toHaveLength(1)
		expect(runs[0]).toMatchObject({ status: 'SUCCEEDED', inputTokens: 3000, outputTokens: 300 })
		expect(runs[0]?.toolCalls[0]?.status).toBe('SUCCEEDED')
		const usage = await prisma.dailyUsage.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(usage.messageCount).toBe(1)
		expect(usage.aiCostUsd.toNumber()).toBeCloseTo(0.004)
	})

	it('replays a completed clientMessageId without calling the model again', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const clientMessageId = randomUUID()
		fake.respond(createCompletion([logFoodCall()]))

		const first = await send(owner, '3 яйця', clientMessageId).expect(201)
		const second = await send(owner, '3 яйця', clientMessageId).expect(201)

		expect(second.body).toEqual(first.body)
		expect(fake.bodies).toHaveLength(1)
		expect(await prisma.message.count()).toBe(2)
		expect(await prisma.foodEntry.count()).toBe(2)
	})

	it('refuses a reused clientMessageId with another text', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const clientMessageId = randomUUID()
		fake.respond(createCompletion([logFoodCall()]))
		await send(owner, '3 яйця', clientMessageId).expect(201)

		const response = await send(owner, 'банан', clientMessageId).expect(409)

		expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('CLIENT_MESSAGE_ID_REUSED')
	})

	it('invalid answer → retry → still invalid: 503, message FAILED; a resend then succeeds', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const clientMessageId = randomUUID()
		fake.respond(
			createCompletion([logFoodCall([INVALID_ITEM])]),
			createCompletion([logFoodCall([INVALID_ITEM])]),
		)

		const failed = await send(owner, 'тарілка супу', clientMessageId).expect(503)

		expect(apiErrorResponseSchema.parse(failed.body).errorCode).toBe('AI_UNAVAILABLE')
		expect(fake.bodies).toHaveLength(2)
		const message = await prisma.message.findFirstOrThrow({ where: { clientMessageId } })
		expect(message.status).toBe('FAILED')
		expect(await prisma.foodEntry.count()).toBe(0)
		const runs = await prisma.aiRun.findMany({ include: { toolCalls: true } })
		expect(runs.map((run) => run.errorCode)).toEqual(['INVALID_TOOL_CALLS', 'INVALID_TOOL_CALLS'])
		expect(runs.flatMap((run) => run.toolCalls.map((call) => call.status))).toEqual([
			'REJECTED',
			'REJECTED',
		])

		fake.respond(createCompletion([logFoodCall([SOUP_ITEM])]))
		const retried = await send(owner, 'тарілка супу', clientMessageId).expect(201)

		expect(sendResponseSchema.parse(retried.body).data.userMessage.id).toBe(message.id)
		expect(await prisma.message.count({ where: { role: 'USER' } })).toBe(1)
	})

	it('a cut-off answer: 422 MESSAGE_TOO_LONG at once, message FAILED, run marked OUTPUT_TRUNCATED', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(TRUNCATED_COMPLETION)

		const response = await send(owner, 'цілий день їжі').expect(422)

		expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('MESSAGE_TOO_LONG')
		expect(fake.bodies).toHaveLength(1)
		const runs = await prisma.aiRun.findMany()
		expect(runs.map((run) => [run.status, run.errorCode])).toEqual([['FAILED', 'OUTPUT_TRUNCATED']])
		expect(await prisma.message.count({ where: { status: 'FAILED' } })).toBe(1)
	})

	it('not_food and reply log nothing', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([{ name: 'not_food', args: { reply: 'Камінь краще не їсти!' } }]),
			createCompletion([{ name: 'reply', args: { text: 'Привіт!' } }]),
		)

		const stone = await send(owner, "з'їв камінь").expect(201)
		const hello = await send(owner, 'привіт').expect(201)

		expect(sendResponseSchema.parse(stone.body).data.assistantMessage).toMatchObject({
			content: 'Камінь краще не їсти!',
			meals: [],
		})
		expect(sendResponseSchema.parse(hello.body).data.assistantMessage.content).toBe('Привіт!')
		expect(await prisma.meal.count()).toBe(0)
	})

	it('stores a clarification linked to its entry and drops a low-impact one', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const lowImpact = {
			name: 'clarify',
			args: {
				question: 'З хлібом?',
				itemIndexes: [0],
				options: [
					{ label: 'Так', kcal: 150 },
					{ label: 'Ні', kcal: 200 },
				],
			},
		}
		fake.respond(createCompletion([logFoodCall([SOUP_ITEM]), soupClarifyCall, lowImpact]))

		const response = await send(owner, 'тарілка супу').expect(201)

		const { assistantMessage } = sendResponseSchema.parse(response.body).data
		expect(assistantMessage.clarifications).toHaveLength(1)
		expect(assistantMessage.clarifications[0]).toMatchObject({
			question: 'Який суп і яка тарілка?',
			impactKcal: 180,
			status: 'OPEN',
			entryIds: [assistantMessage.meals[0]?.entries[0]?.id],
		})
	})

	it('adds a second message to the same meal and uses the named meal type', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const dinner = (items: unknown[]) => ({
			name: 'log_food',
			args: { items, mealType: 'DINNER', reply: 'Смачного!' },
		})
		fake.respond(
			createCompletion([dinner(EGGS_AND_BUCKWHEAT_ITEMS.slice(0, 1))]),
			createCompletion([dinner(EGGS_AND_BUCKWHEAT_ITEMS.slice(1))]),
		)

		await send(owner, 'на вечерю 3 яйця').expect(201)
		const second = await send(owner, 'і ще гречка на вечерю').expect(201)

		const meal = sendResponseSchema.parse(second.body).data.assistantMessage.meals[0]
		expect(meal?.type).toBe('DINNER')
		expect(meal?.entries.map((entry) => entry.name)).toEqual(['Гречка варена'])
		expect(meal?.totals.kcal).toBe(343)
		expect(await prisma.meal.count()).toBe(1)
	})

	it('splits a whole day into meals by item, in the day order, keeping clarify links', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const [eggs, buckwheat] = EGGS_AND_BUCKWHEAT_ITEMS
		const day = {
			name: 'log_food',
			args: {
				items: [
					{ ...SOUP_ITEM, mealType: 'DINNER' },
					{ ...eggs, mealType: 'BREAKFAST' },
					{ ...buckwheat, mealType: 'DINNER' },
				],
				mealType: null,
				reply: 'Записав день',
			},
		}
		const soupQuestion = {
			name: 'clarify',
			args: {
				question: 'Який суп?',
				itemIndexes: [0],
				options: [
					{ label: 'Бульйон', kcal: 60 },
					{ label: 'Густий', kcal: 330 },
				],
			},
		}
		fake.respond(createCompletion([day, soupQuestion]))

		const response = await send(owner, 'сніданок: яйця; вечеря: суп і гречка').expect(201)

		const { assistantMessage } = sendResponseSchema.parse(response.body).data
		expect(assistantMessage.meals.map((meal) => meal.type)).toEqual(['BREAKFAST', 'DINNER'])
		expect(assistantMessage.meals[1]?.entries.map((entry) => entry.name)).toEqual([
			'Суп',
			'Гречка варена',
		])
		const soupId = assistantMessage.meals[1]?.entries[0]?.id
		expect(assistantMessage.clarifications[0]?.entryIds).toEqual([soupId])
		expect(await prisma.meal.count()).toBe(2)

		const feed = listResponseSchema.parse((await owner.agent.get(MESSAGES_URL).expect(200)).body)
		expect(feed.data[0]?.meals.map((meal) => meal.type)).toEqual(['BREAKFAST', 'DINNER'])
	})

	it('mixes item and message meal types and adds to a meal logged earlier that day', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const [eggs, buckwheat] = EGGS_AND_BUCKWHEAT_ITEMS
		const breakfast = {
			name: 'log_food',
			args: { items: [eggs], mealType: 'BREAKFAST', reply: 'Ок' },
		}
		const mixed = {
			name: 'log_food',
			args: {
				items: [{ ...SOUP_ITEM, mealType: 'BREAKFAST' }, buckwheat],
				mealType: 'DINNER',
				reply: 'Ок',
			},
		}
		fake.respond(createCompletion([breakfast]), createCompletion([mixed]))
		await send(owner, 'на сніданок яйця').expect(201)

		const response = await send(owner, 'ще суп зранку, а на вечерю гречка').expect(201)

		const { meals } = sendResponseSchema.parse(response.body).data.assistantMessage
		expect(meals.map((meal) => [meal.type, meal.entries.map((entry) => entry.name)])).toEqual([
			['BREAKFAST', ['Суп']],
			['DINNER', ['Гречка варена']],
		])
		// the morning meal is the same one: eggs (233) + soup (150)
		expect(meals[0]?.totals.kcal).toBe(383)
		expect(await prisma.meal.count()).toBe(2)
	})

	it('stops at the daily AI limit with 429 and marks the message FAILED', async () => {
		await start({ AI_DAILY_MESSAGE_LIMIT: '1' })
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([logFoodCall()]))
		await send(owner, '3 яйця').expect(201)

		const response = await send(owner, 'банан').expect(429)

		expect(apiErrorResponseSchema.parse(response.body)).toMatchObject({
			errorCode: 'DAILY_LIMIT_REACHED',
			details: { limit: 1 },
		})
		expect(fake.bodies).toHaveLength(1)
		expect(await prisma.message.count({ where: { status: 'FAILED' } })).toBe(1)
	})

	it('gives the model day totals, the goal and only the own saved foods', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		await prisma.userGoal.create({
			data: {
				userId: owner.userId,
				type: 'LOSE',
				dailyKcal: 2000,
				proteinG: 140,
				fatG: 70,
				carbsG: 200,
				validFrom: new Date('2026-01-01T00:00:00Z'),
			},
		})
		const myFood = (userId: string, name: string) => ({
			userId,
			name,
			nameNormalized: name.toLowerCase(),
			kcalPer100g: 380,
			proteinPer100g: 30,
			fatPer100g: 12,
			carbsPer100g: 35,
			source: 'LABEL' as const,
			category: 'protein_bar' as const,
		})
		const ownBar = await prisma.myFood.create({ data: myFood(owner.userId, 'Батончик Olimp') })
		await prisma.myFood.create({ data: myFood(stranger.userId, 'Батончик Чужий') })
		// the model's numbers for a memory item are ignored: the backend scales the saved food
		const barItem = {
			...SOUP_ITEM,
			name: 'Батончик Olimp',
			grams: 60,
			kcal: 225,
			protein: 18,
			fat: 7,
			carbs: 21,
			category: 'plate',
			source: 'MEMORY',
			memoryRef: 'm1',
		}
		fake.respond(createCompletion([logFoodCall([barItem])]))

		const response = await send(owner, 'з’їв батончик olimp і батончик чужий').expect(201)

		const prompt = JSON.stringify(fake.bodies[0])
		expect(prompt).toContain('Remaining today: 2000 kcal')
		expect(prompt).toContain('m1: \\"Батончик Olimp\\"')
		expect(prompt).not.toContain('Чужий\\"')
		const entry = sendResponseSchema.parse(response.body).data.assistantMessage.meals[0]?.entries[0]
		expect(entry).toMatchObject({
			kcal: 228,
			protein: 18,
			category: 'protein_bar',
			source: 'MEMORY',
		})
		const stored = await prisma.myFood.findUniqueOrThrow({ where: { id: ownBar.id } })
		expect(stored.usageCount).toBe(1)
		expect(sendResponseSchema.parse(response.body).data.dayTotals).toMatchObject({
			goalKcal: 2000,
			remainingKcal: 1772,
		})
	})

	it('rejects an invented memory ref instead of attaching it', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const invented = { ...SOUP_ITEM, source: 'MEMORY', memoryRef: 'm9' }
		fake.respond(
			createCompletion([logFoodCall([invented])]),
			createCompletion([logFoodCall([invented])]),
		)

		await send(owner, 'тарілка супу').expect(503)

		expect(await prisma.foodEntry.count()).toBe(0)
	})

	it('pages the feed newest first with a cursor', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		for (const text of ['3 яйця', 'банан', 'кава']) {
			fake.respond(createCompletion([logFoodCall()]))
			await send(owner, text).expect(201)
		}

		const first = listResponseSchema.parse(
			(await owner.agent.get(MESSAGES_URL).query({ limit: 4 }).expect(200)).body,
		)
		expect(first.data.map((message) => message.content)).toEqual([
			'Записав!',
			'кава',
			'Записав!',
			'банан',
		])
		expect(first.data[0]?.meals[0]?.entries).toHaveLength(2)
		expect(first.meta.nextCursor).not.toBeNull()

		const second = listResponseSchema.parse(
			(
				await owner.agent
					.get(MESSAGES_URL)
					.query({ limit: 4, cursor: first.meta.nextCursor })
					.expect(200)
			).body,
		)
		expect(second.data.map((message) => message.content)).toEqual(['Записав!', '3 яйця'])
		expect(second.meta).toEqual({ limit: 4, nextCursor: null })

		const invalid = await owner.agent.get(MESSAGES_URL).query({ cursor: 'nope' }).expect(422)
		expect(apiErrorResponseSchema.parse(invalid.body).details).toEqual({
			fields: { cursor: 'INVALID_CURSOR' },
		})
	})

	it('IDOR: another user sees none of the messages and gets an own message for the same id', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		const clientMessageId = randomUUID()
		fake.respond(createCompletion([logFoodCall()]), createCompletion([logFoodCall()]))
		const own = await send(owner, '3 яйця', clientMessageId).expect(201)

		const list = listResponseSchema.parse((await stranger.agent.get(MESSAGES_URL).expect(200)).body)
		expect(list.data).toEqual([])

		const theirs = await send(stranger, '3 яйця', clientMessageId).expect(201)
		const ownId = sendResponseSchema.parse(own.body).data.userMessage.id
		expect(sendResponseSchema.parse(theirs.body).data.userMessage.id).not.toBe(ownId)
		expect(await prisma.foodEntry.count({ where: { userId: owner.userId } })).toBe(2)
		expect(await prisma.foodEntry.count({ where: { userId: stranger.userId } })).toBe(2)
	})

	it('refuses a resend while the first request runs, and takes over a lost PENDING turn', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const clientMessageId = randomUUID()
		await prisma.message.create({
			data: {
				userId: owner.userId,
				role: 'USER',
				status: 'PENDING',
				clientMessageId,
				content: '3 яйця',
			},
		})

		const busy = await send(owner, '3 яйця', clientMessageId).expect(409)
		expect(apiErrorResponseSchema.parse(busy.body).errorCode).toBe('MESSAGE_IN_PROGRESS')
		expect(fake.bodies).toHaveLength(0)

		// the first request died (crash, deploy): its PENDING row is older than 2 minutes
		await prisma.$executeRaw`UPDATE messages SET updated_at = now() - interval '3 minutes' WHERE client_message_id = ${clientMessageId}`
		fake.respond(createCompletion([logFoodCall()]))
		const resumed = await send(owner, '3 яйця', clientMessageId).expect(201)

		expect(sendResponseSchema.parse(resumed.body).data.userMessage.status).toBe('COMPLETED')
		expect(await prisma.message.count({ where: { role: 'USER' } })).toBe(1)
	})

	it('leaves soft-deleted entries out of meal and day totals', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([logFoodCall()]), createCompletion([logFoodCall([SOUP_ITEM])]))
		await send(owner, '3 яйця і гречка').expect(201)
		await prisma.foodEntry.updateMany({
			where: { name: 'Яйце варене' },
			data: { deletedAt: new Date() },
		})

		const response = await send(owner, 'тарілка супу').expect(201)

		const { assistantMessage, dayTotals } = sendResponseSchema.parse(response.body).data
		// 110 buckwheat + 150 soup; the deleted 233 kcal of eggs is gone
		expect(assistantMessage.meals[0]?.totals.kcal).toBe(260)
		expect(dayTotals.totals.kcal).toBe(260)
	})

	it('throttles POST /messages at 20 per minute per IP', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const invalid = { clientMessageId: 'not-a-uuid', text: 'x' }
		for (let index = 0; index < 20; index += 1) {
			await owner.agent.post(MESSAGES_URL).send(invalid).expect(422)
		}

		const response = await owner.agent.post(MESSAGES_URL).send(invalid).expect(429)

		expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('TOO_MANY_REQUESTS')
	})

	it('requires auth and a valid body', async () => {
		await start()
		await request(app.getHttpServer()).get(MESSAGES_URL).expect(401)
		await request(app.getHttpServer())
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text: 'x' })
			.expect(401)
		const owner = await registerUser('owner@kus.app')

		const response = await owner.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: 'not-a-uuid', text: '   ' })
			.expect(422)

		expect(apiErrorResponseSchema.parse(response.body).details).toEqual({
			fields: { clientMessageId: 'INVALID_FORMAT', text: 'TOO_SMALL' },
		})
		expect(fake.bodies).toHaveLength(0)
	})
})
