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

const logFood = (date: string) => ({
	name: 'log_food',
	args: {
		items: [{ ...SOUP_ITEM, date, mealType: 'DINNER' }],
		date: null,
		mealType: null,
		reply: 'Записав!',
	},
})

const showDay = (date: string | null) => ({
	name: 'show_day',
	args: { date, reply: 'Ось цей день' },
})

describe('day card of show_day (e2e, real DB, fake model)', () => {
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

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('answers with a snapshot of yesterday, counted by the backend', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const yesterday = formatDbDate(addDays(getToday(owner), -1))
		fake.respond(createCompletion([logFood(yesterday)]), createCompletion([showDay(yesterday)]))
		await send(owner, 'вчора суп').expect(201)

		const response = await send(owner, 'покажи вчора').expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		expect(data.assistantMessage.content).toBe('Ось цей день')
		expect(data.assistantMessage.dayCard).toMatchObject({
			version: 1,
			localDate: yesterday,
			kind: 'past',
			asOf: null,
			totals: { kcal: SOUP_ITEM.kcal },
			goal: null,
			remainingKcal: null,
			meals: [{ type: 'DINNER', kcal: SOUP_ITEM.kcal }],
		})
		expect(data.userMessage.dayCard).toBeNull()
		const stored = await prisma.message.findFirstOrThrow({
			where: { id: data.assistantMessage.id },
		})
		expect(stored.dayCard).not.toBeNull()
	})

	it('shows today as it stands now and tomorrow as planned', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = formatDbDate(getToday(owner))
		const tomorrow = formatDbDate(addDays(getToday(owner), 1))
		fake.respond(
			createCompletion([logFood(today)]),
			createCompletion([showDay(null)]),
			createCompletion([logFood(tomorrow)]),
			createCompletion([showDay(tomorrow)]),
		)
		await send(owner, 'сьогодні суп').expect(201)
		const todayCard = sendResponseSchema.parse((await send(owner, 'що сьогодні').expect(201)).body)
			.data.assistantMessage.dayCard
		await send(owner, 'завтра суп').expect(201)

		const response = await send(owner, 'покажи завтра').expect(201)

		expect(todayCard).toMatchObject({ localDate: today, kind: 'today' })
		expect(todayCard?.asOf).not.toBeNull()
		const { data } = sendResponseSchema.parse(response.body)
		expect(data.assistantMessage.dayCard).toMatchObject({
			localDate: tomorrow,
			kind: 'planned',
			asOf: null,
		})
	})

	it('keeps only the text for a day without entries', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const yesterday = formatDbDate(addDays(getToday(owner), -1))
		fake.respond(createCompletion([showDay(yesterday)]))

		const response = await send(owner, 'покажи вчора').expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		expect(data.assistantMessage.content).toBe('Ось цей день')
		expect(data.assistantMessage.dayCard).toBeNull()
		const stored = await prisma.message.findFirstOrThrow({
			where: { id: data.assistantMessage.id },
		})
		expect(stored.dayCard).toBeNull()
	})

	it('returns the snapshot in the history and does not refresh it after later entries', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const yesterday = formatDbDate(addDays(getToday(owner), -1))
		fake.respond(
			createCompletion([logFood(yesterday)]),
			createCompletion([showDay(yesterday)]),
			createCompletion([logFood(yesterday)]),
		)
		await send(owner, 'вчора суп').expect(201)
		await send(owner, 'покажи вчора').expect(201)
		await send(owner, 'ще суп вчора').expect(201)

		const feed = listResponseSchema.parse((await owner.agent.get(MESSAGES_URL).expect(200)).body)

		const cards = feed.data.flatMap(({ dayCard }) => dayCard ?? [])
		expect(cards).toHaveLength(1)
		expect(cards[0]?.totals.kcal).toBe(SOUP_ITEM.kcal)
	})

	it('reads a damaged snapshot as no card instead of failing the history', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const yesterday = formatDbDate(addDays(getToday(owner), -1))
		fake.respond(createCompletion([logFood(yesterday)]), createCompletion([showDay(yesterday)]))
		await send(owner, 'вчора суп').expect(201)
		const shown = sendResponseSchema.parse((await send(owner, 'покажи вчора').expect(201)).body)
		await prisma.message.update({
			where: { id: shown.data.assistantMessage.id },
			data: { dayCard: { version: 99 } },
		})

		const feed = listResponseSchema.parse((await owner.agent.get(MESSAGES_URL).expect(200)).body)

		const reply = feed.data.find(({ id }) => id === shown.data.assistantMessage.id)
		expect(reply?.content).toBe('Ось цей день')
		expect(reply?.dayCard).toBeNull()
	})

	it('does not show the card to another user', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		const yesterday = formatDbDate(addDays(getToday(owner), -1))
		fake.respond(createCompletion([logFood(yesterday)]), createCompletion([showDay(yesterday)]))
		await send(owner, 'вчора суп').expect(201)
		await send(owner, 'покажи вчора').expect(201)

		const feed = listResponseSchema.parse((await stranger.agent.get(MESSAGES_URL).expect(200)).body)

		expect(feed.data.filter(({ dayCard }) => dayCard !== null)).toEqual([])
	})
})
