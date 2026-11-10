import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	authSessionResponseSchema,
	createDataResponseSchema,
	sendMessageResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { addDays, formatDbDate, getLocalDate } from '../src/common/time'
import {
	createCompletion,
	createFakeAiClient,
	type FakeToolCall,
	logFoodCall,
} from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)
const fake = createFakeAiClient()
/** Names no food of the context, so a ref can only come from a read. */
const MESSAGE_TEXT = 'їв ту штуку'

interface TestUser {
	agent: TestAgent
	userId: string
	timezone: string
}

const toDbDate = (date: string): Date => new Date(`${date}T00:00:00Z`)

const findFood = (args: Record<string, unknown>): FakeToolCall => ({ name: 'find_food', args })

/** 45 g of the saved bar: the model writes its own numbers, the backend scales the saved ones. */
const memoryItem = (memoryRef: string) => ({
	name: 'SportyFeel Pro',
	grams: 45,
	quantity: null,
	kcal: 180,
	protein: 18,
	fat: 4.5,
	carbs: 16.9,
	fiber: null,
	category: 'protein_bar',
	source: 'MEMORY',
	confidence: 0.9,
	assumption: null,
	memoryRef,
})

/** Half of the hummus: the numbers of the model are not stored, the copy is scaled by the backend. */
const copyItem = (copyRef: string) => ({
	name: 'Хумус',
	grams: 50,
	quantity: null,
	kcal: 100,
	protein: 4,
	fat: 7,
	carbs: 6,
	fiber: null,
	category: 'plate',
	source: 'ESTIMATE',
	confidence: 0.5,
	assumption: null,
	memoryRef: null,
	copyRef,
})

describe('find_food (e2e, real DB, fake model)', () => {
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

	const seedFood = (user: TestUser, name: string, deletedAt: Date | null = null) =>
		prisma.myFood.create({
			data: {
				userId: user.userId,
				name,
				nameNormalized: name.toLowerCase(),
				kcalPer100g: 400,
				proteinPer100g: 40,
				fatPer100g: 10,
				carbsPer100g: 37.5,
				pieceGrams: 45,
				category: 'protein_bar',
				source: 'MANUAL',
				deletedAt,
			},
		})

	/** One 100 g entry three days ago, straight into the database. */
	const seedEntry = async (user: TestUser, name: string, deletedAt: Date | null = null) => {
		const date = formatDbDate(addDays(getLocalDate(new Date(), user.timezone), -3))
		const meal = await prisma.meal.create({
			data: {
				userId: user.userId,
				type: 'DINNER',
				localDate: toDbDate(date),
				eatenAt: new Date(`${date}T17:00:00Z`),
			},
		})
		return prisma.foodEntry.create({
			data: {
				userId: user.userId,
				mealId: meal.id,
				name,
				grams: 100,
				kcal: 200,
				proteinG: 8,
				fatG: 14,
				carbsG: 12,
				category: 'plate',
				source: 'ESTIMATE',
				confidence: 0.5,
				deletedAt,
				// an old row: the context only lists the entries deleted lately (for «поверни»)
				createdAt: new Date('2026-01-01T00:00:00Z'),
			},
		})
	}

	const requestText = (index: number): string => JSON.stringify(fake.bodies[index])

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('logs the refs two reads handed out: a saved food (memoryRef) and an earlier entry (copyRef)', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const saved = await seedFood(owner, 'SportyFeel Pro')
		await seedEntry(owner, 'Хумус класичний')
		fake.respond(
			createCompletion([findFood({ query: 'спортіфіл', scope: 'saved' })]),
			createCompletion([findFood({ query: 'хумус', scope: 'history' })]),
			createCompletion([logFoodCall([memoryItem('m1'), copyItem('h1')])]),
		)

		const response = await send(owner, MESSAGE_TEXT).expect(201)

		expect(fake.bodies).toHaveLength(3)
		expect(requestText(1)).toContain('m1 \\"SportyFeel Pro\\"')
		expect(requestText(2)).toContain('h1 ')
		const { data } = sendResponseSchema.parse(response.body)
		const entries = data.assistantMessage.meals.flatMap((meal) => meal.entries)
		expect(entries).toHaveLength(2)
		// the saved food is scaled from its per-100 g values by the backend (45 g of 400 kcal)
		expect(entries.find((entry) => entry.name === 'SportyFeel Pro')).toMatchObject({
			grams: 45,
			kcal: 180,
			source: 'MEMORY',
		})
		const stored = await prisma.foodEntry.findMany({
			where: { sourceMessageId: data.userMessage.id },
		})
		expect(stored.find((entry) => entry.name === 'SportyFeel Pro')?.myFoodId).toBe(saved.id)
		// the copy takes the values of the earlier entry (200 kcal per 100 g), not the model's
		const copy = stored.find((entry) => entry.name === 'Хумус класичний' || entry.name === 'Хумус')
		expect(copy).toMatchObject({ grams: 50, kcal: 100 })
		expect(copy?.copiedFromDate).not.toBeNull()
		const runs = await prisma.aiRun.findMany({ where: { messageId: data.userMessage.id } })
		expect(runs).toHaveLength(3)
	})

	it('does not find a food or an entry of another user or a deleted one', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		await seedFood(stranger, 'Секретний батончик')
		await seedEntry(stranger, 'Секретний хумус')
		await seedFood(owner, 'Видалений батончик', new Date())
		await seedEntry(owner, 'Видалений хумус', new Date())
		fake.respond(
			createCompletion([findFood({ query: 'секретний', scope: 'all' })]),
			createCompletion([findFood({ query: 'видалений', scope: 'all' })]),
			createCompletion([logFoodCall([memoryItem('m1')])]),
			createCompletion([
				logFoodCall([{ ...memoryItem('m1'), source: 'ESTIMATE', memoryRef: null }]),
			]),
		)

		await send(owner, MESSAGE_TEXT).expect(201)

		expect(requestText(1)).toContain('No match for \\"секретний\\"')
		expect(requestText(2)).toContain('No match for \\"видалений\\"')
		// nothing was handed out, so the m1 of the third answer was refused and the model retried
		expect(fake.bodies).toHaveLength(4)
		const everything = fake.bodies.map((body) => JSON.stringify(body)).join('\n')
		expect(everything).not.toContain('Секретний батончик')
		expect(everything).not.toContain('Секретний хумус')
		expect(everything).not.toContain('Видалений батончик')
		expect(everything).not.toContain('Видалений хумус')
	})
})
