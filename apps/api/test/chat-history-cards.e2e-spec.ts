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
import { createCompletion, createFakeAiClient, SOUP_ITEM } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)
const listResponseSchema = createCursorPaginatedResponseSchema(chatMessageSchema)

const fake = createFakeAiClient()

interface TestUser {
	agent: TestAgent
	userId: string
	timezone: string
}

const toDbDate = (date: string): Date => new Date(`${date}T00:00:00Z`)

const closeDay = (date: string | null, estimatedTotalKcal: number | null) => ({
	name: 'close_day',
	args: { date, estimatedTotalKcal, reply: 'День закрито' },
})

const showStats = (endDate: string | null = null) => ({
	name: 'show_stats',
	args: { period: 'week', endDate, reply: 'Ось тиждень' },
})

/** Half of the soup, as the model would write it: consistent numbers that differ from the copy. */
const copiedSoup = (copyRef: string) => ({
	...SOUP_ITEM,
	grams: 150,
	kcal: 36,
	protein: 0,
	fat: 0,
	carbs: 9,
	category: 'other',
	copyRef,
})

const logCopy = (copyRef: string) => ({
	name: 'log_food',
	args: { items: [copiedSoup(copyRef)], date: null, mealType: null, reply: 'Записав!' },
})

describe('closing a day, week stats and copying earlier entries (e2e, real DB, fake model)', () => {
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

	const getToday = (user: TestUser): Date => getLocalDate(new Date(), user.timezone)
	const dayOffset = (user: TestUser, offset: number): string =>
		formatDbDate(addDays(getToday(user), offset))

	const setGoal = (user: TestUser, dailyKcal = 2000) =>
		prisma.userGoal.create({
			data: {
				userId: user.userId,
				type: 'LOSE',
				dailyKcal,
				proteinG: 140,
				fatG: 70,
				carbsG: 200,
				validFrom: toDbDate('2026-01-01'),
			},
		})

	/** One soup-like entry straight into the database, on a day of its own meal. */
	const seedEntry = async (
		user: TestUser,
		date: string,
		{
			kcal = 150,
			name = 'Суп',
			deletedAt = null,
		}: { kcal?: number; name?: string; deletedAt?: Date | null } = {},
	) => {
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
				grams: 300,
				kcal,
				proteinG: kcal / 25,
				fatG: kcal / 25,
				carbsG: kcal / 8,
				category: 'soup',
				source: 'LABEL',
				confidence: 0.9,
				deletedAt,
			},
		})
	}

	/** What the model got for the first try; a retry also carries the parser's error text. */
	const firstRequestText = (): string => JSON.stringify(fake.bodies[0])

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	describe('close_day', () => {
		it('logs one «Без деталей» estimate for the gap and answers with the closing card', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await setGoal(owner)
			const yesterday = dayOffset(owner, -1)
			await seedEntry(owner, yesterday, { kcal: 150 })
			fake.respond(createCompletion([closeDay(yesterday, 1950)]))

			const response = await send(owner, 'вчора за день десь 1950, підсумуй').expect(201)

			const { data } = sendResponseSchema.parse(response.body)
			expect(data.assistantMessage.dayCard).toMatchObject({
				localDate: yesterday,
				kind: 'past',
				isClosing: true,
				verdict: 'on_goal',
				totals: { kcal: 1950 },
			})
			const gap = await prisma.foodEntry.findMany({
				where: { name: 'Без деталей' },
				include: { meal: true },
			})
			expect(gap).toHaveLength(1)
			expect(gap[0]).toMatchObject({
				userId: owner.userId,
				kcal: 1800,
				source: 'ESTIMATE',
				confidence: 0.3,
				category: 'plate',
				sourceMessageId: data.userMessage.id,
			})
			expect(gap[0]?.meal.type).toBe('SNACK')
			const stored = await prisma.message.findFirstOrThrow({
				where: { id: data.assistantMessage.id },
			})
			expect(stored.dayCard).toMatchObject({ isClosing: true, verdict: 'on_goal' })
		})

		it('logs nothing when the estimate is not above what is logged, and subtracts nothing', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await setGoal(owner)
			const yesterday = dayOffset(owner, -1)
			await seedEntry(owner, yesterday, { kcal: 150 })
			fake.respond(createCompletion([closeDay(yesterday, 100)]))

			const response = await send(owner, 'вчора за день 100').expect(201)

			const { data } = sendResponseSchema.parse(response.body)
			expect(data.assistantMessage.dayCard).toMatchObject({
				totals: { kcal: 150 },
				verdict: 'far_under',
				isClosing: true,
			})
			expect(await prisma.foodEntry.count({ where: { name: 'Без деталей' } })).toBe(0)
			expect(await prisma.foodEntry.count({ where: { deletedAt: null } })).toBe(1)
		})

		it('closes an empty day by the user total alone', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			fake.respond(createCompletion([closeDay(null, 1500)]))

			const response = await send(owner, 'сьогодні в сумі 1500').expect(201)

			const { data } = sendResponseSchema.parse(response.body)
			expect(data.assistantMessage.dayCard).toMatchObject({
				kind: 'today',
				verdict: 'no_goal',
				totals: { kcal: 1500 },
			})
			expect(await prisma.foodEntry.count({ where: { userId: owner.userId } })).toBe(1)
		})

		it('keeps only the text for an empty day without an estimate', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			fake.respond(createCompletion([closeDay(null, null)]))

			const response = await send(owner, 'все на сьогодні').expect(201)

			const { data } = sendResponseSchema.parse(response.body)
			expect(data.assistantMessage.content).toBe('День закрито')
			expect(data.assistantMessage.dayCard).toBeNull()
		})

		it('refuses a day in the future: 503 after the retry, nothing logged', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const tomorrow = dayOffset(owner, 1)
			fake.respond(
				createCompletion([closeDay(tomorrow, 1800)]),
				createCompletion([closeDay(tomorrow, 1800)]),
			)

			await send(owner, 'завтра все').expect(503)

			expect(await prisma.foodEntry.count()).toBe(0)
		})
	})

	describe('show_stats', () => {
		it('stores a week snapshot ending today and returns it in the history', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await setGoal(owner)
			await seedEntry(owner, dayOffset(owner, -1), { kcal: 1900 })
			await seedEntry(owner, dayOffset(owner, -3), { kcal: 2500 })
			await seedEntry(owner, dayOffset(owner, -4), { kcal: 1700 })
			await seedEntry(owner, dayOffset(owner, 0), { kcal: 300 })
			fake.respond(createCompletion([showStats()]))

			const response = await send(owner, 'як мій тиждень').expect(201)

			const { data } = sendResponseSchema.parse(response.body)
			expect(data.assistantMessage.statsCard).toMatchObject({
				period: 'week',
				from: dayOffset(owner, -6),
				to: dayOffset(owner, 0),
				loggedDays: 4,
				daysInNorm: 3,
				avgKcal: 1600,
				goalKcal: 2000,
				weightChangeKg: null,
			})
			expect(data.userMessage.statsCard).toBeNull()
			expect(data.assistantMessage.dayCard).toBeNull()
			const feed = listResponseSchema.parse((await owner.agent.get(MESSAGES_URL).expect(200)).body)
			expect(feed.data.find(({ id }) => id === data.assistantMessage.id)?.statsCard).toEqual(
				data.assistantMessage.statsCard,
			)
		})

		it('replaces the model text with the fixed one when nothing was logged in the period', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedEntry(owner, dayOffset(owner, -10), { kcal: 300 })
			fake.respond(createCompletion([showStats()]))

			const { data } = sendResponseSchema.parse((await send(owner, 'тиждень').expect(201)).body)

			expect(data.assistantMessage.content).toBe(STATS_EMPTY_REPLY)
			expect(data.assistantMessage.statsCard).toBeNull()
		})

		it('accepts today as the last day', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = dayOffset(owner, 0)
			await seedEntry(owner, today, { kcal: 300 })
			fake.respond(createCompletion([showStats(today)]))

			const { data } = sendResponseSchema.parse(
				(await send(owner, 'тиждень по сьогодні').expect(201)).body,
			)

			expect(data.assistantMessage.statsCard).toMatchObject({ to: today, loggedDays: 1 })
		})

		it('refuses a future last day: 503 after the retry', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const tomorrow = dayOffset(owner, 1)
			fake.respond(createCompletion([showStats(tomorrow)]), createCompletion([showStats(tomorrow)]))

			await send(owner, 'тиждень по завтра').expect(503)
		})

		it('counts only the own entries and shows the card to nobody else', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const stranger = await registerUser('stranger@kus.app')
			await seedEntry(stranger, dayOffset(stranger, -1), { kcal: 4000 })
			await seedEntry(owner, dayOffset(owner, -1), { kcal: 1000 })
			fake.respond(createCompletion([showStats()]))
			await send(owner, 'тиждень').expect(201)

			const ownerFeed = listResponseSchema.parse(
				(await owner.agent.get(MESSAGES_URL).expect(200)).body,
			)
			const strangerFeed = listResponseSchema.parse(
				(await stranger.agent.get(MESSAGES_URL).expect(200)).body,
			)

			expect(ownerFeed.data.flatMap(({ statsCard }) => statsCard ?? [])).toMatchObject([
				{ loggedDays: 1, avgKcal: 1000 },
			])
			expect(strangerFeed.data.filter(({ statsCard }) => statsCard !== null)).toEqual([])
		})

		it('reads a damaged snapshot as no card instead of failing the history', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedEntry(owner, dayOffset(owner, -1), { kcal: 1000 })
			fake.respond(createCompletion([showStats()]))
			const shown = sendResponseSchema.parse((await send(owner, 'тиждень').expect(201)).body)
			await prisma.message.update({
				where: { id: shown.data.assistantMessage.id },
				data: { statsCard: { version: 99 } },
			})

			const feed = listResponseSchema.parse((await owner.agent.get(MESSAGES_URL).expect(200)).body)

			const reply = feed.data.find(({ id }) => id === shown.data.assistantMessage.id)
			expect(reply?.content).toBe('Ось тиждень')
			expect(reply?.statsCard).toBeNull()
		})
	})

	describe('copyRef', () => {
		it('shows yesterday to a message that points back and copies its values, scaled by the backend', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedEntry(owner, dayOffset(owner, -1), { kcal: 150 })
			fake.respond(createCompletion([logCopy('y1')]))

			const response = await send(owner, 'половину того самого, що вчора').expect(201)

			expect(firstRequestText()).toContain('Earlier entries (copyRef')
			expect(firstRequestText()).toMatch(/y1 .* DINNER .*Суп.*300 g, 150 kcal/)
			const { data } = sendResponseSchema.parse(response.body)
			expect(data.assistantMessage.meals[0]?.entries[0]).toMatchObject({
				name: SOUP_ITEM.name,
				grams: 150,
				kcal: 75,
				category: 'soup',
				source: 'LABEL',
				confidence: 0.9,
			})
		})

		it('stores the copy even when the macros of the model do not add up, with one model call', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedEntry(owner, dayOffset(owner, -1), { kcal: 150 })
			const sloppy = { ...copiedSoup('y1'), kcal: 400, protein: 1, fat: 0, carbs: 9 }
			fake.respond(
				createCompletion([
					{
						name: 'log_food',
						args: { items: [sloppy], date: null, mealType: null, reply: 'Записав!' },
					},
				]),
			)

			const response = await send(owner, 'половину того самого, що вчора').expect(201)

			expect(fake.bodies).toHaveLength(1)
			const { data } = sendResponseSchema.parse(response.body)
			expect(data.assistantMessage.meals[0]?.entries[0]).toMatchObject({
				grams: 150,
				kcal: 75,
				category: 'soup',
				source: 'LABEL',
			})
		})

		it('keeps the link to the saved food of the copied entry', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const food = await prisma.myFood.create({
				data: {
					userId: owner.userId,
					name: 'Суп',
					nameNormalized: 'суп',
					kcalPer100g: 50,
					proteinPer100g: 2,
					fatPer100g: 2,
					carbsPer100g: 6,
					category: 'soup',
					source: 'LABEL',
				},
			})
			const entry = await seedEntry(owner, dayOffset(owner, -1))
			await prisma.foodEntry.update({ where: { id: entry.id }, data: { myFoodId: food.id } })
			fake.respond(createCompletion([logCopy('y1')]))

			await send(owner, 'те саме що вчора').expect(201)

			const created = await prisma.foodEntry.findFirstOrThrow({
				where: { userId: owner.userId, id: { not: entry.id } },
			})
			expect(created.myFoodId).toBe(food.id)
		})

		it('adds no section for a message that does not point back, so a ref is refused', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedEntry(owner, dayOffset(owner, -1))
			fake.respond(createCompletion([logCopy('y1')]), createCompletion([logCopy('y1')]))

			// the model names a ref it was never shown: the parser rejects it, twice
			await send(owner, 'суп').expect(503)

			expect(firstRequestText()).not.toContain('Earlier entries (copyRef')
			expect(await prisma.foodEntry.count({ where: { userId: owner.userId } })).toBe(1)
		})

		it("never shows or copies another user's entries", async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const stranger = await registerUser('stranger@kus.app')
			await seedEntry(stranger, dayOffset(stranger, -1), { name: 'Секретна страва' })
			fake.respond(createCompletion([logCopy('y1')]), createCompletion([logCopy('y1')]))

			await send(owner, 'як вчора').expect(503)

			expect(fake.bodies).toHaveLength(2)
			expect(JSON.stringify(fake.bodies)).not.toContain('Секретна страва')
			expect(await prisma.foodEntry.count({ where: { userId: owner.userId } })).toBe(0)
		})

		it('does not list a deleted entry, so a ref to it is refused', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedEntry(owner, dayOffset(owner, -1), { deletedAt: new Date() })
			fake.respond(createCompletion([logCopy('y1')]), createCompletion([logCopy('y1')]))

			await send(owner, 'як вчора').expect(503)

			expect(firstRequestText()).not.toContain('Earlier entries (copyRef')
			expect(
				await prisma.foodEntry.count({ where: { userId: owner.userId, deletedAt: null } }),
			).toBe(0)
		})

		it('stores nothing with the model numbers when the copied entry is deleted while the model answers', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const entry = await seedEntry(owner, dayOffset(owner, -1), { kcal: 150 })
			fake.respond(createCompletion([logCopy('y1')]))
			const post = vi.mocked(fake.client.post)
			const original = post.getMockImplementation()
			post.mockImplementationOnce(async (...args) => {
				await prisma.foodEntry.update({ where: { id: entry.id }, data: { deletedAt: new Date() } })
				return original?.(...args)
			})

			const response = await send(owner, 'половину того самого, що вчора').expect(409)

			expect(response.body).toEqual({
				statusCode: 409,
				errorCode: 'TURN_COPY_SOURCE_MISSING',
				details: {},
			})
			expect(firstRequestText()).toContain('Earlier entries (copyRef')
			// FAILED is what lets the client resend the same clientMessageId
			expect(
				await prisma.message.count({ where: { userId: owner.userId, status: 'FAILED' } }),
			).toBe(1)
			expect(await prisma.foodEntry.count({ where: { userId: owner.userId } })).toBe(1)
			expect(
				await prisma.foodEntry.count({ where: { userId: owner.userId, deletedAt: null } }),
			).toBe(0)
		})

		it('finds an older entry by the food the message names as h1', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedEntry(owner, dayOffset(owner, -10), { name: 'Гречка', kcal: 300 })
			await seedEntry(owner, dayOffset(owner, -9), { name: 'Окрошка літня', kcal: 200 })
			fake.respond(createCompletion([logCopy('h1')]))

			const response = await send(owner, 'гречку як минулого разу').expect(201)

			expect(firstRequestText()).toMatch(/h1 .*Гречка/)
			expect(firstRequestText()).not.toContain('Окрошка літня')
			const { data } = sendResponseSchema.parse(response.body)
			expect(data.assistantMessage.meals[0]?.entries[0]).toMatchObject({ kcal: 150 })
		})
	})
})
